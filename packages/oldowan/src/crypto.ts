/**
 * Ed25519 algorithm identifier for Web Crypto API calls.
 * Use this object with crypto.subtle.generateKey and importKey functions.
 */
export const ED25519_ALGORITHM_IDENTIFIER = Object.freeze({ name: 'Ed25519' });

/**
 * Generates a new Ed25519 keypair and exports raw key bytes.
 *
 * Exports the public key in 'raw' format and the private key in 'pkcs8', slices the private key to 32 bytes,
 * then concatenates public||private into a single Buffer.
 *
 * @returns A Buffer containing 64 bytes: [publicKey (32 bytes) || privateKey (32 bytes)].
 */
export const generateKeypairRawBytes = async () => {
  const keypair = (await crypto.subtle.generateKey(
    ED25519_ALGORITHM_IDENTIFIER, //
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;

  const publicKeyBytes = await crypto.subtle.exportKey(
    'raw',
    keypair.publicKey,
  );
  const pkcs8Bytes = await crypto.subtle.exportKey('pkcs8', keypair.privateKey);
  const privateKeyBytes = pkcs8Bytes.slice(16);

  // concatenate public and private key bytes
  const keypairBytes = Buffer.concat([
    new Uint8Array(privateKeyBytes),
    new Uint8Array(publicKeyBytes),
  ]);

  return keypairBytes;
};
