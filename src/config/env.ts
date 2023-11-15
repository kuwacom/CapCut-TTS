import 'dotenv/config';
const env = {
    CapCutAPIURL: process.env.CAPCUT_API_URL as string,
    ByteintlApi: process.env.BYTEINTL_API_URL as string,
    DeviceTime: process.env.DEVICE_TIME as string,
    Sign: process.env.SIGN as string,
    UserAgent: process.env.USER_AGENT as string,
    // Node Setting
    ErrorHandle: process.env.ERROR_HANDLE == 'true' ? true : false,
    // Server Setting
    Host: process.env.HOST as string,
    Port: Number(process.env.PORT),
    Origin: process.env.ORIGIN as string,
    TokenInterval: Number(process.env.TOKEN_INTERVAL)
}

export default env;