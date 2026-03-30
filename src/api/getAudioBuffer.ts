import { WebSocket } from 'ws';
import {
  buildTaskMessage,
  getWebSocketUrl,
  parseTaskStatus,
  rawDataToBuffer,
} from '@/utils/capcut';
import logger from '@/services/logger';
import type { SynthesizeOptions } from '@/types/capcut';
import { formatBytes } from '@/utils/utils';

export default function getAudioBuffer(
  token: string,
  appKey: string,
  options: SynthesizeOptions
): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let audioBuffer = Buffer.alloc(0);
    let settled = false;
    const startedAt = Date.now();

    // WS Connect
    const ws = new WebSocket(getWebSocketUrl());

    const finalize = (buffer: Buffer | null) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(buffer);
    };

    ws.on('open', () => {
      logger.debug('Connected to CapCut websocket.');
      ws.send(JSON.stringify(buildTaskMessage(token, appKey, options)));
    });

    ws.on('message', (data) => {
      const taskStatus = parseTaskStatus(data);

      if (!taskStatus) {
        audioBuffer = Buffer.concat([audioBuffer, rawDataToBuffer(data)]);
        return;
      }

      if (taskStatus.event === 'TaskStarted') {
        logger.debug(`TaskStarted: ${taskStatus.task_id}`);
        return;
      }

      if (taskStatus.event === 'TaskFinished') {
        logger.debug(
          `TaskFinished: ${taskStatus.task_id} / Audio Buffer Size: ${formatBytes(
            audioBuffer.byteLength
          )} / Tasking Time: ${Date.now() - startedAt}ms`
        );
        ws.close();
        finalize(audioBuffer);
      }
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error while buffering audio.', error);
      finalize(null);
    });

    ws.on('close', () => {
      if (!settled) {
        logger.warn('CapCut websocket closed before the task finished.');
        finalize(null);
      }
    });
  });
}
