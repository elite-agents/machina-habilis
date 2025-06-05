import { expect, test, describe, beforeEach } from 'bun:test';
import bs58 from 'bs58';
import {
  SignJWT,
  decodeJwt,
  decodeProtectedHeader,
  errors,
  type JWTPayload,
} from 'jose';

import {
  deriveDidIdentifierFromEd25519KeyPair,
  generateDidKeyEd25519JWT,
  verifyDidKeyEd25519JWT,
  DEFAULT_EXPIRES_AFTER_SECONDS,
  DID_KEY_PREFIX,
  BASE58BTC_MULTICODEC_PREFIX,
  ED25519_PUB_MULTICODEC_PREFIX,
} from '..'; // Assuming this resolves to packages/auth/src/index.ts

describe('DID Key JWT Authentication', () => {
  let ed25519KeyPair: CryptoKeyPair;
  let rsaKeyPair: CryptoKeyPair; // For testing non-Ed25519 keys

  // Time mocking has been removed. Tests will use actual system time.

  beforeEach(async () => {
    ed25519KeyPair = await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true, // extractable
      ['sign', 'verify'],
    );
    rsaKeyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );

    // Time mocking setup removed.
  });

  // afterEach for time mocking removed.

  describe('deriveDidIdentifierFromEd25519KeyPair', () => {
    test('should derive a valid DID identifier for an Ed25519 key pair', async () => {
      const didIdentifier =
        await deriveDidIdentifierFromEd25519KeyPair(ed25519KeyPair);
      expect(didIdentifier).toBeString();
      expect(didIdentifier.startsWith(BASE58BTC_MULTICODEC_PREFIX)).toBe(true);

      const multibaseDecoded = bs58.decode(
        didIdentifier.substring(BASE58BTC_MULTICODEC_PREFIX.length),
      );
      const prefix = multibaseDecoded.subarray(
        0,
        ED25519_PUB_MULTICODEC_PREFIX.length,
      );
      expect(prefix).toEqual(ED25519_PUB_MULTICODEC_PREFIX);
      expect(multibaseDecoded.length).toBe(
        ED25519_PUB_MULTICODEC_PREFIX.length + 32,
      ); // 32 for raw Ed25519 pubkey
    });

    test('should throw an error for non-Ed25519 key pairs', async () => {
      await expect(
        deriveDidIdentifierFromEd25519KeyPair(rsaKeyPair),
      ).rejects.toThrow(
        'Unsupported public key algorithm: RSASSA-PKCS1-v1_5. Expected Ed25519 for multicodec 0xed01.',
      );
    });
  });

  describe('generateDidKeyEd25519JWT', () => {
    const audience = 'test-audience';

    test('should generate a JWT with correct claims and kid header', async () => {
      const jwt = await generateDidKeyEd25519JWT(audience, ed25519KeyPair);
      expect(jwt).toBeString();

      const payload = decodeJwt(jwt);
      const protectedHeader = decodeProtectedHeader(jwt);
      const derivedDid =
        await deriveDidIdentifierFromEd25519KeyPair(ed25519KeyPair);

      expect(payload.iss).toBe(`${DID_KEY_PREFIX}${derivedDid}`);
      expect(payload.sub).toBe(`${DID_KEY_PREFIX}${derivedDid}`);
      expect(payload.aud).toBe(audience);
      expect(typeof payload.iat).toBe('number');
      expect(typeof payload.exp).toBe('number');
      // Allow a small delta (e.g., 5 seconds) for processing time and clock differences
      expect(payload.exp).toBeGreaterThanOrEqual(
        payload.iat! + DEFAULT_EXPIRES_AFTER_SECONDS - 5,
      );
      expect(payload.exp).toBeLessThanOrEqual(
        payload.iat! + DEFAULT_EXPIRES_AFTER_SECONDS + 5,
      );

      expect(protectedHeader.alg).toBe('EdDSA');
      expect(protectedHeader.typ).toBe('JWT');
      expect(protectedHeader.kid).toBe(
        `${DID_KEY_PREFIX}${derivedDid}#${derivedDid}`,
      );
    });

    test('should use provided didIdentifier if available', async () => {
      const customDid = 'zCustomTestDID12345';
      const jwt = await generateDidKeyEd25519JWT(audience, ed25519KeyPair, {
        didIdentifier: customDid,
      });
      const payload = decodeJwt(jwt);
      const protectedHeader = decodeProtectedHeader(jwt);

      expect(payload.iss).toBe(`${DID_KEY_PREFIX}${customDid}`);
      expect(payload.sub).toBe(`${DID_KEY_PREFIX}${customDid}`);
      expect(protectedHeader.kid).toBe(
        `${DID_KEY_PREFIX}${customDid}#${customDid}`,
      );
    });

    test('should use custom expiration if provided', async () => {
      const customExpires = 60; // 1 minute
      const jwt = await generateDidKeyEd25519JWT(audience, ed25519KeyPair, {
        expiresAfterSeconds: customExpires,
      });
      const payload = decodeJwt(jwt);
      expect(typeof payload.iat).toBe('number');
      expect(typeof payload.exp).toBe('number');
      // Allow a small delta (e.g., 5 seconds) for processing time
      expect(payload.exp).toBeGreaterThanOrEqual(
        payload.iat! + customExpires - 5,
      );
      expect(payload.exp).toBeLessThanOrEqual(payload.iat! + customExpires + 5);
    });
  });

  describe('verifyDidKeyEd25519JWT', () => {
    const audience = 'test-audience';
    let validJwt: string;
    let derivedDid: string;

    beforeEach(async () => {
      derivedDid = await deriveDidIdentifierFromEd25519KeyPair(ed25519KeyPair);
      validJwt = await generateDidKeyEd25519JWT(audience, ed25519KeyPair);
    });

    test('should successfully verify a valid JWT', async () => {
      const payload = await verifyDidKeyEd25519JWT(validJwt, audience);
      expect(payload.iss).toBe(`${DID_KEY_PREFIX}${derivedDid}`);
      expect(payload.sub).toBe(`${DID_KEY_PREFIX}${derivedDid}`);
      expect(payload.aud).toBe(audience);
      expect(typeof payload.iat).toBe('number');
    });

    test('should fail if JWT is expired', async () => {
      // Generate a JWT that was issued and expired in the past
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const derivedDidForExpiredTest =
        await deriveDidIdentifierFromEd25519KeyPair(ed25519KeyPair);
      const expiredJwt = await new SignJWT({ aud: audience })
        .setProtectedHeader({
          alg: 'EdDSA',
          typ: 'JWT',
          kid: `${DID_KEY_PREFIX}${derivedDidForExpiredTest}#${derivedDidForExpiredTest}`,
        })
        .setIssuedAt(pastTimestamp - 60) // Issued 1 hour and 60 seconds ago
        .setIssuer(`${DID_KEY_PREFIX}${derivedDidForExpiredTest}`)
        .setSubject(`${DID_KEY_PREFIX}${derivedDidForExpiredTest}`)
        .setExpirationTime(pastTimestamp) // Expired 1 hour ago
        .sign(ed25519KeyPair.privateKey);

      await expect(
        verifyDidKeyEd25519JWT(expiredJwt, audience),
      ).rejects.toThrow(errors.JWTExpired);
    });

    test('should fail if audience does not match', async () => {
      await expect(
        verifyDidKeyEd25519JWT(validJwt, 'wrong-audience'),
      ).rejects.toThrow(errors.JWTClaimValidationFailed);
      // Can also check message: .toThrow(/unexpected "aud" claim value/)
    });

    test('should succeed if audience in JWT is an array and expected is a string member', async () => {
      const jwtWithAudArray = await new SignJWT({
        aud: [audience, 'another-aud'],
      })
        .setProtectedHeader({
          alg: 'EdDSA',
          typ: 'JWT',
          kid: `${DID_KEY_PREFIX}${derivedDid}#${derivedDid}`,
        })
        .setIssuedAt() // Sets to current time
        .setIssuer(`${DID_KEY_PREFIX}${derivedDid}`)
        .setSubject(`${DID_KEY_PREFIX}${derivedDid}`)
        .setExpirationTime(`${DEFAULT_EXPIRES_AFTER_SECONDS}s`) // Sets relative to current time (e.g., '180s')
        .sign(ed25519KeyPair.privateKey);
      const payload = await verifyDidKeyEd25519JWT(jwtWithAudArray, audience);
      expect(payload.aud).toEqual([audience, 'another-aud']);
    });

    test('should fail if signature is invalid (tampered JWT)', async () => {
      const tamperedJwt = validJwt.slice(0, -5) + 'XXXXX';
      await expect(
        verifyDidKeyEd25519JWT(tamperedJwt, audience),
      ).rejects.toThrow(errors.JWSSignatureVerificationFailed);
    });

    test('should fail if JWT signed with a different key but claims to be from original key', async () => {
      const anotherKeyPair = await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
      );
      // JWT is signed by anotherKeyPair, but its 'iss' and 'kid' claim to be derived from ed25519KeyPair (derivedDid)
      const jwtMaliciousIss = await new SignJWT({ aud: audience })
        .setProtectedHeader({
          alg: 'EdDSA',
          typ: 'JWT',
          kid: `${DID_KEY_PREFIX}${derivedDid}#${derivedDid}`,
        })
        .setIssuedAt()
        .setIssuer(`${DID_KEY_PREFIX}${derivedDid}`)
        .setSubject(`${DID_KEY_PREFIX}${derivedDid}`)
        .setExpirationTime(`${DEFAULT_EXPIRES_AFTER_SECONDS}s`)
        .sign(anotherKeyPair.privateKey);

      await expect(
        verifyDidKeyEd25519JWT(jwtMaliciousIss, audience),
      ).rejects.toThrow(errors.JWSSignatureVerificationFailed);
    });

    test('should fail for malformed did:key in iss (e.g. wrong multicodec)', async () => {
      // Create a DID with a valid base58btc prefix but an invalid multicodec (e.g., all zeros)
      const malformedMulticodecBytes = new Uint8Array([
        0,
        0,
        ...new Uint8Array(32).fill(1),
      ]);
      const malformedDidIdentifier =
        BASE58BTC_MULTICODEC_PREFIX + bs58.encode(malformedMulticodecBytes);
      const malformedIss = `${DID_KEY_PREFIX}${malformedDidIdentifier}`;

      const jwt = await new SignJWT({ aud: audience })
        .setProtectedHeader({
          alg: 'EdDSA',
          typ: 'JWT',
          kid: `${malformedIss}#${malformedDidIdentifier}`,
        })
        .setIssuedAt()
        .setIssuer(malformedIss)
        .setSubject(malformedIss)
        .setExpirationTime('2h')
        .sign(ed25519KeyPair.privateKey);
      await expect(verifyDidKeyEd25519JWT(jwt, audience)).rejects.toThrow(
        'Invalid DID identifier: multicodec prefix is not for Ed25519-pub.',
      );
    });

    test('should fail if kid header is missing', async () => {
      const jwtNoKid = await new SignJWT({ aud: audience })
        .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' }) // No kid
        .setIssuedAt()
        .setIssuer(`${DID_KEY_PREFIX}${derivedDid}`)
        .setSubject(`${DID_KEY_PREFIX}${derivedDid}`)
        .setExpirationTime('2h')
        .sign(ed25519KeyPair.privateKey);
      await expect(verifyDidKeyEd25519JWT(jwtNoKid, audience)).rejects.toThrow(
        /^Invalid 'kid' in JWT header. Expected .* got 'undefined'\.$/,
      );
    });

    test('should fail if kid header is malformed', async () => {
      const jwtWrongKid = await new SignJWT({ aud: audience })
        .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: 'wrongkidformat' })
        .setIssuedAt()
        .setIssuer(`${DID_KEY_PREFIX}${derivedDid}`)
        .setSubject(`${DID_KEY_PREFIX}${derivedDid}`)
        .setExpirationTime('2h')
        .sign(ed25519KeyPair.privateKey);
      await expect(
        verifyDidKeyEd25519JWT(jwtWrongKid, audience),
      ).rejects.toThrow(
        /^Invalid 'kid' in JWT header. Expected .* got 'wrongkidformat'\.$/,
      );
    });

    test('should fail if iss and sub claims do not match', async () => {
      const anotherDid = await deriveDidIdentifierFromEd25519KeyPair(
        await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
          'sign',
          'verify',
        ]),
      );
      const jwt = await new SignJWT({ aud: audience })
        .setProtectedHeader({
          alg: 'EdDSA',
          typ: 'JWT',
          kid: `${DID_KEY_PREFIX}${derivedDid}#${derivedDid}`,
        })
        .setIssuedAt()
        .setIssuer(`${DID_KEY_PREFIX}${derivedDid}`)
        .setSubject(`${DID_KEY_PREFIX}${anotherDid}`) // Different sub
        .setExpirationTime('2h')
        .sign(ed25519KeyPair.privateKey);
      await expect(verifyDidKeyEd25519JWT(jwt, audience)).rejects.toThrow(
        "'sub' claim must be identical to 'iss' claim.",
      );
    });

    test('should fail if iss claim is not a did:key identifier', async () => {
      const jwt = await new SignJWT({ aud: audience })
        .setProtectedHeader({
          alg: 'EdDSA',
          typ: 'JWT',
          kid: `notadidkey#notadidkey`,
        })
        .setIssuedAt()
        .setIssuer(`notadidkey`) // Not a did:key
        .setSubject(`notadidkey`)
        .setExpirationTime('2h')
        .sign(ed25519KeyPair.privateKey);
      await expect(verifyDidKeyEd25519JWT(jwt, audience)).rejects.toThrow(
        "Invalid or missing 'iss' claim: must be a 'did:key' identifier.",
      );
    });

    test('should fail for completely malformed JWT string', async () => {
      const malformedJwt = 'this.is.not.a.jwt';
      await expect(
        verifyDidKeyEd25519JWT(malformedJwt, audience),
      ).rejects.toThrow(/^Invalid JWT format:/);
    });
  });
});
