import express, { Request, Response, text } from 'express';

import getAudioBuffer from '../api/getAudioBuffer';
import { USER } from '../token';
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
        req.query.volume = ' 10';
    }


    const audioBuffer = await getAudioBuffer(USER.token, USER.appKey,
        req.query.text as string,
        Number(req.query.type),
        Number(req.query.pitch),
        Number(req.query.speed),
        Number(req.query.volume));

    if (!audioBuffer) {
        res.status(500).json({
            error: "can't get token"
        });
        return;
    }

    res.status(200).end(audioBuffer);
    return;
}