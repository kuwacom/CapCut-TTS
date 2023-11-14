import env from '../config/env';
import { Synthesize, SynthesizePayload, TaskStatus } from '../types/capcut';
import logger from '../utils/log';
import { WebSocket } from 'ws';
export default function getAudioBuffer(token: string, appkey: string, text: string, type: number, pitch: number = 10, speed: number = 10, volume: number = 10): Promise<Buffer | null> {

    let speaker: string;
    if (type === 0) {
        // カワボ
        speaker = "カワボ";
    } else if (type === 1) {
        // お姉さん
        speaker = "お姉さん";
    } else if (type === 2) {
        // 少女
        speaker = "少女";
    } else if (type === 3) {
        // 男子
        speaker = "男子";
    } else if (type === 4) {
        // 坊ちゃん
        speaker = "坊ちゃん";
    } else if (type === 5) {
        // 癒し系女子
        speaker = "癒し系女子";
    } else if (type === 6) {
        // 女子アナ
        speaker = "女子アナ";
    } else if (type === 7) {
        // 男性アナ
        speaker = "男性アナ";
    } else if (type === 8) {
        // 元気ロリ
        speaker = "元気ロリ";
    } else if (type === 9) {
        // 明るいハニー
        speaker = "明るいハニー";
    } else if (type === 10) {
        // 優しいレディー
        speaker = "優しいレディー";
    } else if (type === 11) {
        // 風雅メゾソプラノ
        speaker = "風雅メゾソプラノ";
    } else if (type === 12) {
        // Naoki
        speaker = "Naoki";
    } else if (type === 13) {
        // Sakura
        speaker = "Sakura";
    } else if (type === 14) {
        // Keiko
        speaker = "Keiko";
    } else if (type === 15) {
        // 7Miho
        speaker = "Miho";
    } else {
        // カワボ
        speaker = "カワボ";
    }
    
    return new Promise((resolve, reject) => {
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
                    // speaker: speaker,
                    speaker: "BV523_streaming",
                    pitch: pitch,
                    speed: speed,
                    volume: volume,
                    rate: 24000,
                    appid: '348188',
                } as SynthesizePayload)
            } as Synthesize));
        });
        
        let audioBuffer: Buffer = Buffer.from([]);
        ws.on('message', (data) => {
            try {
                const dataJson = JSON.parse(data.toString()) as TaskStatus;
                
                if (dataJson.event === 'TaskStarted') {
                    logger.debug("TaskStarted: "+dataJson.task_id);
                } else if (dataJson.event === 'TaskFinished') {
                    logger.debug("TaskFinished: "+dataJson.task_id);
                    ws.close();
                    resolve(audioBuffer);
                }
            } catch (error) {
                audioBuffer = Buffer.concat([audioBuffer, data as Buffer]);
            }
        });
    
        ws.on('error', (error) => {
            logger.error('WebSocket error:', error);
            resolve(null);
        });
    });
}