import fetch, { Headers } from 'node-fetch';

import env from '../config/env';
import { GetTokenRes } from '../types/response';
import logger from '../utils/log';

export default async function getToken(): Promise<GetTokenRes | null> {
    const headers = new Headers();
    headers.append('Appvr', '11.0.0');
    headers.append('Device-Time', env.DeviceTime);
    headers.append('Pf', '1');
    headers.append('Sign', env.Sign);
    headers.append('Sign-Ver', '1');
    headers.append('Tdid', 'web');
    headers.append('User-Agent', env.UserAgent);

    try {
        const res = await fetch(env.CapCutAPIURL+"/common/tts/token", {
            method: 'POST',
            headers: headers
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (error) {
        logger.error("can't get token");
        return null;
    }
}