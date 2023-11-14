import 'dotenv/config';
const env = {
    CapCutAPIURL: process.env.CAPCUT_API_URL as string,
    ByteintlApi: process.env.BYTEINTL_API_URL as string,
    DeviceTime: process.env.DEVICE_TIME as string,
    Sign: process.env.SIGN as string,
    UserAgent: process.env.USER_AGENT as string,
    // Node Setting
    errorHandle: process.env.ERROR_HANDLE == 'true' ? true : false,
    // Server Setting
    host: process.env.HOST as string,
    port: Number(process.env.PORT),
    origin: process.env.ORIGIN as string,
}

export default env;