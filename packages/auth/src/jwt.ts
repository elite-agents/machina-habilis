import bs58 from 'bs58';
import { SignJWT, jwtVerify, decodeJwt, type JWTPayload } from 'jose';
import {
  BASE58BTC_MULTICODEC_PREFIX,
  DEFAULT_EXPIRES_AFTER_SECONDS,
  DID_KEY_PREFIX,
  ED25519_PUB_MULTICODEC_PREFIX,
  ED25519_RAW_PUBKEY_LENGTH,
} from './constants';

/**
 * Derives a DID identifier for the "did:key" method from an Ed25519 key pair.
 * This is based on the multicodec specification for ed25519-pub (0xed01).
 * The multibase prefix for Base58BTC is 'z'.
 *
 * @param keypair - The Ed25519 key pair to derive the DID identifier from
 * @returns The derived DID identifier
 */
export const deriveDidIdentifierFromEd25519KeyPair = async (
  keypair: CryptoKeyPair,
) => {
  // 1. Verify the key algorithm and export the public key to raw bytes (ArrayBuffer)
  if (
    keypair.publicKey.type !== 'public' ||
    keypair.publicKey.algorithm.name !== 'Ed25519'
  ) {
    throw new Error(
      `Unsupported public key algorithm: ${keypair.publicKey.algorithm.name}. Expected Ed25519 for multicodec 0xed01.`,
    );
  }

  const publicKeyArrayBuffer = await crypto.subtle.exportKey(
    'raw',
    keypair.publicKey,
  );

  // Convert ArrayBuffer to Uint8Array
  const publicKeyBytes = new Uint8Array(publicKeyArrayBuffer);

  // 2. Create the multicodec prefix for ed25519-pub (0xed01)
  // This assumes the key is an Ed25519 public key.
  // The multicodec for ed25519-pub is 0xed01.
  const multicodecPrefix = ED25519_PUB_MULTICODEC_PREFIX;

  // 3. Concatenate prefix and public key bytes
  const multicodecPublicKey = new Uint8Array(
    multicodecPrefix.length + publicKeyBytes.length,
  );
  multicodecPublicKey.set(multicodecPrefix, 0);
  multicodecPublicKey.set(publicKeyBytes, multicodecPrefix.length);

  // 4. Multibase encode: Convert to Base58BTC
  const hexString = bs58.encode(multicodecPublicKey);

  // 5. Prepend the multibase prefix for Base58BTC ('z')
  const didIdentifier = BASE58BTC_MULTICODEC_PREFIX + hexString;

  return didIdentifier;
};

export interface CreateJWTOptions {
  didIdentifier?: string;
  expiresAfterSeconds?: number;
}

/**
 * Creates a JWT signed with the provided Ed25519 key pair for use with agent authentication.
 *
 * @param aud - The intended audience for the JWT (e.g., the server or resource receiving the token).
 * @param keypair - The Ed25519 key pair used to sign the JWT. The public key will be used to derive a DID identifier if not provided.
 * @param options - Configuration options for creating the JWT:
 *   - didIdentifier: (optional) Use this as the DID identifier for the issuer (iss) and subject (sub) fields. If omitted, it is derived from the public key in the keypair.
 *   - expiresAfterSeconds: (optional) How many seconds until the token expires, relative to now. Defaults to DEFAULT_EXPIRES_AFTER_SECONDS (1 minute).
 * @returns The signed JWT as a string.
 */
export const generateDidKeyEd25519JWT = async (
  aud: string,
  keypair: CryptoKeyPair,
  options: CreateJWTOptions = {},
): Promise<string> => {
  const {
    didIdentifier: providedDidIdentifier,
    expiresAfterSeconds = DEFAULT_EXPIRES_AFTER_SECONDS,
  } = options;

  const didIdentifier =
    providedDidIdentifier ??
    (await deriveDidIdentifierFromEd25519KeyPair(keypair));

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresAfterSeconds;

  const payload = {
    iss: `did:key:${didIdentifier}`,
    sub: `did:key:${didIdentifier}`,
    aud,
    exp,
    iat,
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({
      alg: 'EdDSA',
      typ: 'JWT',
      kid: `did:key:${didIdentifier}#${didIdentifier}`,
    })
    .sign(keypair.privateKey);

  return jwt;
};

async function getPublicKeyFromDidIdentifier(
  didIdentifier: string,
): Promise<CryptoKey> {
  if (!didIdentifier.startsWith(BASE58BTC_MULTICODEC_PREFIX)) {
    throw new Error(
      `Invalid DID identifier: multibase prefix is not '${BASE58BTC_MULTICODEC_PREFIX}'.`,
    );
  }

  const multibaseDecoded = bs58.decode(
    didIdentifier.substring(BASE58BTC_MULTICODEC_PREFIX.length),
  );

  if (
    multibaseDecoded.length !==
    ED25519_PUB_MULTICODEC_PREFIX.length + ED25519_RAW_PUBKEY_LENGTH
  ) {
    throw new Error(
      'Invalid DID identifier: decoded length does not match Ed25519 multicodec key length.',
    );
  }

  const decodedPrefix = multibaseDecoded.subarray(
    0,
    ED25519_PUB_MULTICODEC_PREFIX.length,
  );
  if (
    !decodedPrefix.every(
      (val, index) => val === ED25519_PUB_MULTICODEC_PREFIX[index],
    )
  ) {
    throw new Error(
      'Invalid DID identifier: multicodec prefix is not for Ed25519-pub.',
    );
  }

  const rawPublicKeyBytes = multibaseDecoded.subarray(
    ED25519_PUB_MULTICODEC_PREFIX.length,
  );

  try {
    return await crypto.subtle.importKey(
      'raw',
      rawPublicKeyBytes,
      { name: 'Ed25519', namedCurve: 'Ed25519' }, // 'namedCurve' is not strictly needed for Ed25519 but often included
      true, // make it extractable if needed, though verify does not require it
      ['verify'],
    );
  } catch (error) {
    throw new Error(
      `Failed to import public key: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Verifies a JWT that was signed with an Ed25519 key pair, where the key is identified
 * by a 'did:key' identifier in the 'iss' and 'sub' claims.
 *
 * @param jwt - The JWT string to verify.
 * @param expectedAudience - (Optional) The expected audience ('aud' claim) of the JWT.
 * @returns The verified JWT payload if successful.
 * @throws An error if verification fails (e.g., signature invalid, token expired, claims mismatch).
 */
export const verifyDidKeyEd25519JWT = async (
  jwt: string,
  expectedAudience?: string,
): Promise<JWTPayload> => {
  // 1. Decode JWT to get claims for key extraction (without signature verification yet)
  let initialPayload: JWTPayload;
  try {
    initialPayload = decodeJwt(jwt);
  } catch (error) {
    throw new Error(
      `Invalid JWT format: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 2. Validate and extract didIdentifier from 'iss' claim
  if (
    !initialPayload.iss ||
    typeof initialPayload.iss !== 'string' ||
    !initialPayload.iss.startsWith(DID_KEY_PREFIX)
  ) {
    throw new Error(
      "Invalid or missing 'iss' claim: must be a 'did:key' identifier.",
    );
  }
  if (initialPayload.sub !== initialPayload.iss) {
    throw new Error("'sub' claim must be identical to 'iss' claim.");
  }
  const didIdentifier = initialPayload.iss.substring(DID_KEY_PREFIX.length);

  // 3. Derive public key from didIdentifier
  const publicKey = await getPublicKeyFromDidIdentifier(didIdentifier);

  // 4. Verify the JWT with the derived public key
  const { payload, protectedHeader } = await jwtVerify(jwt, publicKey, {
    algorithms: ['EdDSA'], // Specify EdDSA algorithm
    issuer: initialPayload.iss, // Verify issuer matches what we expect
    subject: initialPayload.sub, // Verify subject matches what we expect
    audience: expectedAudience, // Verify audience if provided
  });

  // Additional check: Ensure the 'kid' in the header matches the full did:key URI
  // The kid format is did:key:<method-specific-id>#<method-specific-id>
  const expectedKid = `${initialPayload.iss}#${didIdentifier}`;
  if (protectedHeader.kid !== expectedKid) {
    throw new Error(
      `Invalid 'kid' in JWT header. Expected '${expectedKid}', got '${protectedHeader.kid}'.`,
    );
  }

  return payload;
};
