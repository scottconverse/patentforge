/**
 * Symmetric encryption for API keys stored in the local database.
 *
 * Uses AES-256-GCM with a machine-derived key (hostname + platform).
 * This protects against casual DB file theft — someone who copies
 * the SQLite file can't read the keys without the machine context.
 *
 * NOT a substitute for a real secrets manager in production.
 * Appropriate for a self-hosted single-user tool.
 */

import * as crypto from 'crypto';
import * as os from 'os';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT = 'patentforge-key-v1'; // Fixed salt — key derivation is deterministic per machine

/** Derive a 256-bit encryption key from machine-specific values. */
function deriveKey(): Buffer {
  const material = `${os.hostname()}:${os.platform()}:${os.userInfo().username}:${SALT}`;
  return crypto.pbkdf2Sync(material, SALT, 100_000, 32, 'sha256');
}

const KEY = deriveKey();

/**
 * Encrypt a plaintext string. Returns a hex-encoded string with format:
 * iv(24 hex) + tag(32 hex) + ciphertext(variable hex)
 *
 * Returns empty string for empty/null input (nothing to encrypt).
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

/**
 * Decrypt a hex-encoded ciphertext produced by encrypt().
 * Returns the original plaintext string.
 *
 * Returns empty string for empty input.
 * Returns the input unchanged if it doesn't look encrypted (migration support).
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';

  // Minimum length: IV(24) + tag(32) + at least 2 hex chars of data
  const minLen = (IV_LENGTH + TAG_LENGTH) * 2 + 2;
  if (ciphertext.length < minLen || !/^[0-9a-f]+$/i.test(ciphertext)) {
    // Not encrypted — return as-is (supports migration from plaintext)
    return ciphertext;
  }

  try {
    const iv = Buffer.from(ciphertext.slice(0, IV_LENGTH * 2), 'hex');
    const tag = Buffer.from(ciphertext.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2), 'hex');
    const data = Buffer.from(ciphertext.slice((IV_LENGTH + TAG_LENGTH) * 2), 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf-8');
  } catch {
    // Decryption failed — likely plaintext from before encryption was enabled
    return ciphertext;
  }
}

/**
 * Check if a string appears to be an encrypted value (hex-encoded, correct min length).
 */
export function isEncrypted(value: string): boolean {
  const minLen = (IV_LENGTH + TAG_LENGTH) * 2 + 2;
  return value.length >= minLen && /^[0-9a-f]+$/i.test(value);
}
