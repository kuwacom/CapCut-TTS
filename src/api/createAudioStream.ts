import { Readable } from 'node:stream';
import { WebSocket } from 'ws';
import {
  buildTaskMessage,
  getWebSocketUrl,
  parseTaskStatus,
  rawDataToBuffer,
} from '@/utils/capcut';
import logger from '@/services/logger';
import type { SynthesizeOptions } from '@/types/capcut';

export default function createAudioStream(
  token: string,
  appKey: string,
  options: SynthesizeOptions
): Readable {
  const audioStream = new Readable({
    read() {},
  });
  const startedAt = Date.now();

  // WS Connect
  const ws = new WebSocket(getWebSocketUrl());
  let taskFinished = false;

  ws.on('open', () => {
    logger.debug('Connected to CapCut websocket.');
    ws.send(JSON.stringify(buildTaskMessage(token, appKey, options)));
  });

  ws.on('message', (data) => {
    const taskStatus = parseTaskStatus(data);

    if (!taskStatus) {
      audioStream.push(rawDataToBuffer(data));
      return;
    }

    if (taskStatus.event === 'TaskStarted') {
      logger.debug(`TaskStarted: ${taskStatus.task_id}`);
      return;
    }

    if (taskStatus.event === 'TaskFinished') {
      taskFinished = true;
      logger.debug(
        `TaskFinished: ${taskStatus.task_id} / Tasking Time: ${
          Date.now() - startedAt
        }ms`
      );
      ws.close();
      audioStream.push(null);
    }
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error while streaming audio.', error);
    audioStream.destroy(
      error instanceof Error ? error : new Error('CapCut websocket error')
    );
  });

  ws.on('close', () => {
    if (!taskFinished && !audioStream.destroyed && !audioStream.readableEnded) {
      audioStream.destroy(
        new Error('CapCut websocket closed before the task finished')
      );
    }
  });

  audioStream.on('close', () => {
    logger.debug(`Audio stream closed after ${Date.now() - startedAt}ms`);

    if (
      ws.readyState === WebSocket.CONNECTING ||
      ws.readyState === WebSocket.OPEN
    ) {
      ws.close();
    }
  });

  return audioStream;
}
