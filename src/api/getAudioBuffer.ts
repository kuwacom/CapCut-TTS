import env from '../config/env';
import { Synthesize, SynthesizePayload, TaskStatus } from '../types/capcut';
import logger from '../utils/log';
import { WebSocket } from 'ws';
import speakerParser from '../utils/speakerParser';
import { formatBytes } from '../utils/util';
export default function getAudioBuffer(token: string, appkey: string, text: string, type: number, pitch: number = 10, speed: number = 10, volume: number = 10): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
        let audioBuffer: Buffer = Buffer.from([]);
        const startTime = new Date().getTime();

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
                    logger.debug(
                        "\nTaskFinished: "+dataJson.task_id+"\n"+
                        "Audio Buffer Size: "+formatBytes(audioBuffer.byteLength)+"\n"+
                        "Tasking Time: "+((new Date().getTime())-startTime)+"ms"
                    );
                    ws.close();
                    resolve(audioBuffer);
                }
            } catch (error) {
                audioBuffer = Buffer.concat([audioBuffer, data as Buffer]);
            }
        });
    
        ws.on('error', (error) => {
            ws.close();
            logger.error('WebSocket error:', error);
            resolve(null);
        });
    });
}