/**
 * Tests for API key encryption/decryption at rest.
 */

import { encrypt, decrypt, isEncrypted, generateSalt } from './encryption';

const TEST_SALT = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

describe('encrypt/decrypt', () => {
  it('round-trips a plaintext string', () => {
    const key = 'sk-ant-api03-abcdef123456';
    const encrypted = encrypt(key, TEST_SALT);
    expect(encrypted).not.toBe(key);
    expect(decrypt(encrypted, TEST_SALT)).toBe(key);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const key = 'sk-ant-api03-test';
    const a = encrypt(key, TEST_SALT);
    const b = encrypt(key, TEST_SALT);
    expect(a).not.toBe(b);
    expect(decrypt(a, TEST_SALT)).toBe(key);
    expect(decrypt(b, TEST_SALT)).toBe(key);
  });

  it('returns empty string for empty input', () => {
    expect(encrypt('', TEST_SALT)).toBe('');
    expect(decrypt('', TEST_SALT)).toBe('');
  });

  it('returns plaintext unchanged if not encrypted (migration support)', () => {
    const plaintext = 'sk-ant-api03-not-encrypted-yet';
    expect(decrypt(plaintext, TEST_SALT)).toBe(plaintext);
  });

  it('cannot decrypt with a different salt', () => {
    const key = 'sk-ant-api03-secret';
    const encrypted = encrypt(key, TEST_SALT);
    const wrongSalt = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    // Should return the ciphertext unchanged (decryption fails, falls through)
    const result = decrypt(encrypted, wrongSalt);
    expect(result).not.toBe(key);
  });

  it('detects encrypted values correctly', () => {
    const encrypted = encrypt('test-key', TEST_SALT);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted('sk-ant-plaintext')).toBe(false);
    expect(isEncrypted('')).toBe(false);
  });

  it('handles unicode in plaintext', () => {
    const key = 'key-with-unicode-🔑';
    expect(decrypt(encrypt(key, TEST_SALT), TEST_SALT)).toBe(key);
  });

  it('returns corrupted ciphertext unchanged on decryption failure (migration fallback)', () => {
    const encrypted = encrypt('test-key', TEST_SALT);
    // Corrupt the ciphertext by flipping bits in the data portion
    const corrupted = encrypted.slice(0, -4) + 'ffff';
    // Should not throw — returns the corrupted string as-is
    const result = decrypt(corrupted, TEST_SALT);
    expect(result).toBe(corrupted);
    expect(result).not.toBe('test-key');
  });

  it('returns truncated hex string unchanged (migration fallback)', () => {
    const encrypted = encrypt('secret-key', TEST_SALT);
    // Truncate to just IV + partial tag — valid hex but too short for real ciphertext
    const truncated = encrypted.slice(0, 60);
    // isEncrypted sees it as potentially encrypted (valid hex, sufficient length)
    // but decrypt should fail gracefully and return it unchanged
    if (isEncrypted(truncated)) {
      const result = decrypt(truncated, TEST_SALT);
      expect(result).toBe(truncated);
    } else {
      // If too short for isEncrypted, decrypt treats as plaintext passthrough
      expect(decrypt(truncated, TEST_SALT)).toBe(truncated);
    }
  });
});

describe('generateSalt', () => {
  it('returns a 64-character hex string', () => {
    const salt = generateSalt();
    expect(salt).toHaveLength(64);
    expect(salt).toMatch(/^[0-9a-f]+$/);
  });

  it('generates unique salts', () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toBe(b);
  });
});
