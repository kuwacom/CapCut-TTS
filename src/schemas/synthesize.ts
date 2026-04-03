import { z } from 'zod';

const singleQueryValue = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }, schema);

const numericQuery = (defaultValue: number) =>
  singleQueryValue(z.coerce.number().int()).default(defaultValue);

const legacyTypeQuery = singleQueryValue(
  z.union([z.coerce.number().int(), z.string().trim().min(1)])
).default(0);

export const SynthesizeQuerySchema = z.object({
  text: singleQueryValue(z.string().trim().min(1, 'text is required')),
  type: legacyTypeQuery,
  voice: singleQueryValue(z.string().trim().min(1)).optional(),
  pitch: numericQuery(10),
  speed: numericQuery(10),
  volume: numericQuery(10),
  method: singleQueryValue(z.enum(['buffer', 'stream'])).default('buffer'),
});

export type SynthesizeQuery = z.infer<typeof SynthesizeQuerySchema>;
