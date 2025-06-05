# @elite-agents/auth

This package provides utilities for creating and verifying self-signed Distributed Identifier (DID) JSON Web Tokens (JWTs) using Ed25519 key pairs. It focuses on adhering to multibase and multicodec standards for DID key representation.

## Overview: Self-Signed DID JWTs

A self-signed Distributed Identifier (DID) JSON Web Token (JWT) is a JWT where the signature is generated using a private key associated with a DID, and the DID is embedded within the token itself. This approach allows for verifiable self-assertion of identity, enabling applications to securely interact with DIDs and their associated information.

The DID is typically included in the `iss` (issuer) and `sub` (subject) claims of the JWT. The `kid` (key ID) header often references the specific key within the DID document used for signing, usually by including the full DID and a fragment identifier pointing to the key (e.g., `did:key:zExampleDID#zExampleDID`).

## Key Features

*   **DID Key Derivation**: Derives `did:key` identifiers from Ed25519 public keys, encoded using multicodec (`0xed01` for Ed25519 public keys) and multibase (Base58BTC with prefix `z`).
*   **JWT Generation**: Creates JWTs signed with an Ed25519 private key. The JWT includes the derived DID key in `iss` and `sub` claims, and a `kid` header referencing the DID key.
*   **JWT Verification**: Verifies self-signed Ed25519 JWTs by:
    *   Extracting the DID from the `iss` claim.
    *   Deriving the public key from the DID.
    *   Validating the JWT signature using the derived public key.
    *   Checking standard claims like `exp` (expiration), `aud` (audience), and ensuring `iss` and `sub` match.
    *   Validating the `kid` header.
*   **Standards Compliant**: Follows `did:key` method specifications, multicodec, and multibase standards.
*   **Minimal Dependencies**: Relies primarily on the Web Crypto API and the `jose` library for JWT handling and `bs58` for Base58 encoding.

## Core Functions

This package exports the following primary functions from `src/index.ts` (via `src/jwt.ts` and `src/constants.ts`):

*   `deriveDidIdentifierFromEd25519KeyPair(keypair: CryptoKeyPair): Promise<string>`
    *   Takes an Ed25519 `CryptoKeyPair`.
    *   Exports the public key, prefixes it with the Ed25519 multicodec (`0xed01`), and then encodes the result using Base58BTC (multibase prefix `z`).
    *   Returns the `did:key` identifier string (without the `did:key:` prefix itself, just the method-specific identifier part starting with `z`).

*   `generateDidKeyEd25519JWT(aud: string, keypair: CryptoKeyPair, options?: CreateJWTOptions): Promise<string>`
    *   `aud`: The audience claim for the JWT.
    *   `keypair`: The Ed25519 `CryptoKeyPair` to sign the JWT.
    *   `options` (optional):
        *   `didIdentifier`: An optional, pre-derived DID identifier to use. If not provided, it's derived from the `keypair`.
        *   `expiresAfterSeconds`: Custom expiration time in seconds (default is 60 seconds).
    *   Generates a JWT with `iss` and `sub` claims set to `did:key:{didIdentifier}` and `kid` header set to `did:key:{didIdentifier}#{didIdentifier}`.
    *   Returns the signed JWT string.

*   `verifyDidKeyEd25519JWT(jwt: string, expectedAudience?: string): Promise<JWTPayload>`
    *   `jwt`: The JWT string to verify.
    *   `expectedAudience` (optional): The audience the JWT is expected to be for.
    *   Decodes the JWT, extracts the `iss` claim to get the DID identifier, derives the public key from this identifier, and then verifies the JWT signature and claims (including `kid` header, `iss`, `sub`, `exp`, and `aud`).
    *   Returns the verified `JWTPayload` if successful; otherwise, throws an error.

## Constants

Key constants are exported from `src/constants.ts`:

*   `ED25519_PUB_MULTICODEC_PREFIX`: `Uint8Array([0xed, 0x01])`
*   `DID_KEY_PREFIX`: `'did:key:'`
*   `BASE58BTC_MULTICODEC_PREFIX`: `'z'`
*   `DEFAULT_EXPIRES_AFTER_SECONDS`: `60` (seconds)

## Usage Example

```typescript
import {
  deriveDidIdentifierFromEd25519KeyPair,
  generateDidKeyEd25519JWT,
  verifyDidKeyEd25519JWT,
  DID_KEY_PREFIX
} from '@elite-agents/auth';

async function main() {
  // 1. Generate an Ed25519 key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true, // extractable
    ['sign', 'verify'],
  );

  // 2. Derive the DID identifier
  const didIdentifier = await deriveDidIdentifierFromEd25519KeyPair(keyPair);
  console.log(`Derived DID: ${DID_KEY_PREFIX}${didIdentifier}`);

  // 3. Generate a JWT
  const audience = 'my-service-audience';
  const jwt = await generateDidKeyEd25519JWT(audience, keyPair);
  console.log('Generated JWT:', jwt);

  // 4. Verify the JWT
  try {
    const payload = await verifyDidKeyEd25519JWT(jwt, audience);
    console.log('JWT Verified! Payload:', payload);
  } catch (error) {
    console.error('JWT Verification Failed:', error);
  }
}

main().catch(console.error);
```

## Installation

```bash
npm install @elite-agents/auth
# or
yarn add @elite-agents/auth
# or if using bun
bun add @elite-agents/auth
```

## Running Tests

Tests are written using Bun's test runner.

```bash
cd packages/auth
bun test
```
