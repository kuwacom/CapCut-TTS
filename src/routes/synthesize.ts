import express, { Request, Response, text } from 'express';

import getAudioBuffer from '../api/getAudioBuffer';
import { USER } from '../token';
import createAudioStream from '../api/createAudioStream';
export default async function synthesize(req: Request, res: Response) {

    if (req.query.text === undefined) {
        res.status(400).json({
            error: "Bad Request"
        });
        return;
    }
    if (req.query.type === undefined) {
        req.query.type = '0';
    }
    if (req.query.pitch === undefined) {
        req.query.pitch = '10';
    }
    if (req.query.speed === undefined) {
        req.query.speed = '10';
    }
    if (req.query.volume === undefined) {
        req.query.volume = '10';
    }
    

    if (req.query.method === undefined || req.query.method == 'buffer') {
        const audioBuffer = await getAudioBuffer(USER.token, USER.appKey,
            req.query.text as string,
            Number(req.query.type),
            Number(req.query.pitch),
            Number(req.query.speed),
            Number(req.query.volume));
    
        if (!audioBuffer) {
            res.status(500).json({
                error: "can't get buffer"
            });
            return;
        }
        
        res.type('audio/wav').status(200).end(audioBuffer);
        return;
    } else if (req.query.method == 'stream') {
        const audioStream = createAudioStream(USER.token, USER.appKey,
            req.query.text as string,
            Number(req.query.type),
            Number(req.query.pitch),
            Number(req.query.speed),
            Number(req.query.volume));
    
        if (!audioStream) {
            res.status(500).json({
                error: "can't get stream"
            });
            return;
        }
        res.on('close', () => audioStream.destroy());
        res.type('audio/wav');
        audioStream.on('data', (data)=>{
            res.write(data);
        });
        audioStream.on('close', ()=>{
            res.end();
        });
        return;
    }
}