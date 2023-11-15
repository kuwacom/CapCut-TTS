import env from '../config/env';
import { Synthesize, SynthesizePayload, TaskStatus } from '../types/capcut';
import logger from '../utils/log';
import { WebSocket } from 'ws';
export default function getAudioBuffer(token: string, appkey: string, text: string, type: number, pitch: number = 10, speed: number = 10, volume: number = 10): Promise<Buffer | null> {

    let speaker: string;
    if (type === 0) {
        // 謎1 男子1
        speaker = "BV525_streaming";
    } else if (type === 1) {
        // 謎2 坊や
        speaker = "BV528_streaming";
    } else if (type === 2) {
        // カワボ
        speaker = "BV017_streaming";
    } else if (type === 3) {
        // お姉さん
        speaker = "BV016_streaming";
    } else if (type === 4) {
        // 少女
        speaker = "BV023_streaming";
    } else if (type === 5) {
        // 女子
        speaker = "BV024_streaming";
    } else if (type === 6) {
        // 男子2
        speaker = "BV018_streaming";
    } else if (type === 7) {
        // 坊ちゃん
        speaker = "BV523_streaming";
    } else if (type === 8) {
        // 女子"
        speaker = "BV521_streaming";
    } else if (type === 9) {
        // 女子アナ
        speaker = "BV522_streaming";
    } else if (type === 10) {
        // 男性アナ
        speaker = "BV524_streaming";
    } else if (type === 11) {
        // 元気ロリ
        speaker = "BV520_streaming";
    } else if (type === 12) {
        // 明るいハニー
        speaker = "VOV401_bytesing3_kangkangwuqu";
    } else if (type === 13) {
        // 優しいレディー
        speaker = "VOV402_bytesing3_oh";
    } else if (type === 14) {
        // 風雅メゾソプラノ
        speaker = "VOV402_bytesing3_aidelizan";
    } else if (type === 15) {
        // Sakura
        speaker = "jp_005";
    } else {
        // お姉さん
        speaker = "BV016_streaming";
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
                    speaker: speaker,
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