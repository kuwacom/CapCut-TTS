import env from '../config/env';
import { Synthesize, SynthesizePayload, TaskStatus } from '../types/capcut';
import logger from '../utils/log';
import { WebSocket } from 'ws';
import stream from 'stream';
import speakerParser from '../utils/speakerParser';
export default function createAudioStream(token: string, appkey: string, text: string, type: number, pitch: number = 10, speed: number = 10, volume: number = 10): stream.Readable | null {
    const audioStream = new stream.Readable();
    audioStream._read = () => {}
    // WS Connect
    const ws = new WebSocket(env.ByteintlApi+"/ws");
    ws.on('open', () => {
        logger.debug("connect ws");
        ws.send(JSON.stringify({
            token: token,
            appkey: appkey,
            namespace: 'TTS',
            event: 'StartTask',
            payload: JSON.stringify({
                text: text,
                speaker: speakerParser(type),
                pitch: pitch,
                speed: speed,
                volume: volume,
                rate: 24000,
                appid: '348188',
            } as SynthesizePayload)
        } as Synthesize));
    });
    
    ws.on('message', (data) => {
        try {
            const dataJson = JSON.parse(data.toString()) as TaskStatus;
            
            if (dataJson.event === 'TaskStarted') {
                logger.debug("TaskStarted: "+dataJson.task_id);
            } else if (dataJson.event === 'TaskFinished') {
                logger.debug("TaskFinished: "+dataJson.task_id);
                ws.close();
                audioStream.push(null);
            }
        } catch (error) {
            audioStream.push(data as Buffer);
        }
    });

    ws.on('error', (error) => {
        ws.close();
        logger.error('WebSocket error:', error);
        audioStream.push(null);
    });

    return audioStream;
}