import { z } from 'zod';

const optionalText = z.string().nullish();
const verdict = z.boolean().nullable().default(null);

// Validate the data we actually consume. TypeScript types alone cannot validate JSON.
export const emailSchema = z.object({
  email: z.string().min(1),
  format_valid: z.boolean().nullable(),
  mx_found: verdict,
  smtp_check: verdict,
  disposable: verdict,
  catch_all: verdict,
  score: z.number().min(0).max(1).nullable().default(null),
});

export const ipSchema = z.object({
  ip: z.string().min(1),
  city: optionalText,
  region_name: optionalText,
  country_name: optionalText,
  country_code: z.string().regex(/^[A-Za-z]{2}$/).nullish(),
  time_zone: z.object({ id: optionalText }).nullish(),
  security: z.object({
    is_proxy: verdict,
    is_tor: verdict,
    threat_level: optionalText,
  }).nullish(),
});

const countrySchema = z.object({
  alpha2Code: z.string().regex(/^[A-Za-z]{2}$/),
  capital: optionalText,
  region: optionalText,
  currencies: z.array(z.object({ code: optionalText })).nullish(),
  callingCodes: z.array(z.string()).nullish(),
  languages: z.array(z.object({ iso639_1: optionalText, name: optionalText })).nullish(),
});
export const countriesSchema = z.array(countrySchema);

export const marketSchema = z.object({
  data: z.array(z.object({
    symbol: z.string().min(1),
    close: z.number().nullable(),
    volume: z.number().nonnegative().nullish(),
    date: z.string().min(1),
    exchange: optionalText,
    price_currency: optionalText,
  })),
});

export const newsSchema = z.object({
  data: z.array(z.object({
    title: z.string().min(1),
    description: optionalText,
    url: z.url().refine((value) => ['https:', 'http:'].includes(new URL(value).protocol)),
    source: z.string().min(1),
    published_at: z.string().min(1),
  })),
});
