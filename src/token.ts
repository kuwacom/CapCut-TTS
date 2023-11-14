import getToken from "./api/getToken";
import env from "./config/env";
import logger from "./utils/log";
import { sleep } from "./utils/util";

export const USER = {
    token: '',
    appKey: ''
}

export async function tokenTask() {
    while(true) {
        if (Number.isNaN(env.TokenInterval)) throw ".env TOKEN_INTERVAL is invalid.";
        logger.info("Token generated");
        const tokenRes = await getToken();
        if (!tokenRes) continue;
        USER.token = tokenRes.data.token;
        USER.appKey = tokenRes.data.app_key;
        await sleep(1000 * 60 * 60 * env.TokenInterval);
    }
}