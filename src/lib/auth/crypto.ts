const encoder = new TextEncoder();

// Cloudflare Workers currently rejects PBKDF2 requests above 100,000 iterations.
export const PASSWORD_HASH_ITERATIONS = 100_000;

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return encodeBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (first: ArrayBuffer, second: ArrayBuffer) => boolean;
  };
  if (typeof subtle.timingSafeEqual === 'function') return subtle.timingSafeEqual(a, b);

  // Node's Web Crypto does not expose timingSafeEqual yet; both digests have a
  // fixed public length, so this fallback cannot disclose either input length.
  const first = new Uint8Array(a);
  const second = new Uint8Array(b);
  let mismatch = 0;
  for (let index = 0; index < first.length; index += 1) mismatch |= first[index] ^ second[index];
  return mismatch === 0;
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return encodeBase64(new Uint8Array(digest));
}

export interface PasswordDigest {
  hash: string;
  salt: string;
}

export async function hashPassword(
  password: string,
  options: { salt?: Uint8Array; iterations?: number } = {},
): Promise<PasswordDigest> {
  const iterations = options.iterations ?? PASSWORD_HASH_ITERATIONS;
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) {
    throw new Error('PBKDF2 iterations must be an integer of at least 100000.');
  }

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const saltBuffer = new Uint8Array(salt).buffer as ArrayBuffer;
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations },
    key,
    256,
  );

  return {
    hash: `pbkdf2-sha256$${iterations}$${encodeBase64(new Uint8Array(bits))}`,
    salt: encodeBase64(salt),
  };
}

export async function verifyPassword(password: string, encodedHash: string, encodedSalt: string): Promise<boolean> {
  const [algorithm, iterationText, expected] = encodedHash.split('$');
  const iterations = Number(iterationText);
  if (algorithm !== 'pbkdf2-sha256' || !expected || !Number.isSafeInteger(iterations) || iterations < 100_000) {
    return false;
  }

  try {
    const actual = await hashPassword(password, { salt: decodeBase64(encodedSalt), iterations });
    return await constantTimeEqual(actual.hash, encodedHash);
  } catch {
    return false;
  }
}
