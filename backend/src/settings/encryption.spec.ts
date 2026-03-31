/**
 * Tests for API key encryption/decryption at rest.
 */

import { encrypt, decrypt, isEncrypted } from './encryption';

describe('encrypt/decrypt', () => {
  it('round-trips a plaintext string', () => {
    const key = 'sk-ant-api03-abcdef123456';
    const encrypted = encrypt(key);
    expect(encrypted).not.toBe(key);
    expect(decrypt(encrypted)).toBe(key);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const key = 'sk-ant-api03-test';
    const a = encrypt(key);
    const b = encrypt(key);
    expect(a).not.toBe(b); // Different IVs
    expect(decrypt(a)).toBe(key);
    expect(decrypt(b)).toBe(key);
  });

  it('returns empty string for empty input', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('returns plaintext unchanged if not encrypted (migration support)', () => {
    const plaintext = 'sk-ant-api03-not-encrypted-yet';
    expect(decrypt(plaintext)).toBe(plaintext);
  });

  it('detects encrypted values correctly', () => {
    const encrypted = encrypt('test-key');
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted('sk-ant-plaintext')).toBe(false);
    expect(isEncrypted('')).toBe(false);
  });

  it('handles unicode in plaintext', () => {
    const key = 'key-with-émojis-🔑';
    expect(decrypt(encrypt(key))).toBe(key);
  });

  it('handles long API keys', () => {
    const longKey = 'sk-ant-api03-' + 'a'.repeat(200);
    expect(decrypt(encrypt(longKey))).toBe(longKey);
  });
});
