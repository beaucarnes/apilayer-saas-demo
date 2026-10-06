import { isIP } from 'node:net';

export const steps = ['all', 'email', 'context', 'feeds', 'signup'] as const;
export type Step = typeof steps[number];
export interface SignupInput { email: string; userIp: string; primaryTicker: string }

export function validateInput(input: SignupInput, step: Step = 'signup'): SignupInput {
  const normalized = { email: input.email.trim(), userIp: input.userIp.trim(), primaryTicker: input.primaryTicker.trim().toUpperCase() };
  if (['all', 'email', 'signup'].includes(step) &&
      (normalized.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email))) {
    throw new Error('Set DEMO_EMAIL to an address in name@example.com form.');
  }
  if (['all', 'context', 'signup'].includes(step) && !isIP(normalized.userIp)) {
    throw new Error('Set DEMO_IP to a valid IPv4 or IPv6 address.');
  }
  if (['all', 'feeds', 'signup'].includes(step) && !/^[A-Z0-9][A-Z0-9.^-]{0,19}$/.test(normalized.primaryTicker)) {
    throw new Error('Set DEMO_TICKER to one valid ticker symbol.');
  }
  return normalized;
}

export function readInput(step: Step, env: NodeJS.ProcessEnv = process.env): SignupInput {
  return validateInput({ email: env.DEMO_EMAIL ?? '', userIp: env.DEMO_IP ?? '', primaryTicker: env.DEMO_TICKER ?? 'AAPL' }, step);
}
