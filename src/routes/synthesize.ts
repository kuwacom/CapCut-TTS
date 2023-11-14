import express, { Request, Response, text } from 'express';

import logger from '../utils/log';
import getToken from '../api/getToken';
import getAudioBuffer from '../api/getAudioBuffer';
export default async function synthesize(req: Request, res: Response) {
    const tokenRes = await getToken();
    if (!tokenRes) {
        res.status(500).json({
            error: "can't get token"
        });
        return;
    }
    const audioBuffer = await getAudioBuffer(tokenRes.data.token, tokenRes.data.app_key,
        "あいうえお", 0, 1, 1, 10);
    // res.status(200).json({
    //     state: "OK",
    //     res: tokenRes
    // });
    res.status(200).end(audioBuffer);
    return;
}