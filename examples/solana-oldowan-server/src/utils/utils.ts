import { createHash } from 'crypto';

export const RPC_URL =
  process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

let workerEnv: Record<string, any>;
export const setWorkerEnv = (env: Record<string, string>) => {
  workerEnv = env;
};

export const getWorkerEnv = () => workerEnv;

export async function storeBlinkKV(blinkKey: string, blinkJson: object) {
  await getWorkerEnv().BLINK_EPHEMERAL_STORE.put(
    blinkKey,
    JSON.stringify(blinkJson),
    {
      expirationTtl: 300,
    },
  );
}

export function getBlinkKVKey(blinkJson: object): string {
  const jsonStr = JSON.stringify(blinkJson);
  const hash = createHash('sha512').update(jsonStr).digest('hex');
  return hash.slice(0, 8); // first 8 hex chars
}

export function getBlinkBaseUrl() {
  return getWorkerEnv()?.BLINK_BASE_URL || 'http://localhost:8787';
}

// Store blinkJson in KV and return the blink URL with the key
export async function getBlinkUrl(blinkJson: object): Promise<string> {
  const blinkKey = getBlinkKVKey(blinkJson);
  await storeBlinkKV(blinkKey, blinkJson);
  return `${getBlinkBaseUrl()}/blink/${blinkKey}`;
}

export async function getBlinkDirective(blinkJson: object): Promise<string> {
  const blinkUrl = await getBlinkUrl(blinkJson);
  return `::blink[${blinkUrl}]`;
}
