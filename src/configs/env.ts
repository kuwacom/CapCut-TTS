import 'dotenv/config';
import { z } from 'zod';

const booleanFlag = z.preprocess(
  (value) => {
    if (value === undefined) {
      return 'true';
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    return String(value).toLowerCase();
  },
  z.enum(['true', 'false']).transform((value) => value === 'true')
);

const envSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_POLICY_ORIGIN: z.string().optional(),
  ORIGIN: z.string().optional(),
  CAPCUT_API_URL: z
    .string()
    .url()
    .default('https://edit-api-sg.capcut.com/lv/v1'),
  BYTEINTL_API_URL: z
    .string()
    .url()
    .default('wss://sami-sg1.byteintlapi.com/internal/api/v1'),
  DEVICE_TIME: z.string().min(1, 'DEVICE_TIME is required'),
  SIGN: z.string().min(1, 'SIGN is required'),
  USER_AGENT: z
    .string()
    .min(1)
    .default(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
    ),
  ERROR_HANDLE: booleanFlag,
  TOKEN_INTERVAL: z.coerce.number().positive().default(6),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errorMessages = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');

  throw new Error(`Invalid environment variables: ${errorMessages}`);
}

const env = {
  ...parsedEnv.data,
  CORS_POLICY_ORIGIN:
    parsedEnv.data.CORS_POLICY_ORIGIN ?? parsedEnv.data.ORIGIN ?? '*',
};

export default env;
