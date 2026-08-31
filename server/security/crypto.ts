import crypto from 'crypto';

const ENCRYPTION_KEY_RAW = process.env.ENCRYPTION_KEY || 'makeen_secure_32_bytes_aes_key!!';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_makeen_sessions';

// Ensure 32 bytes key for AES-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest();

/**
 * Hash password securely with unique salt using PBKDF2
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify password against stored hash and salt
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Encrypt sensitive credentials (e.g., MikroTik passwords) at rest using AES-256-GCM
 */
export function encryptCredential(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt credential encrypted with AES-256-GCM
 */
export function decryptCredential(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }
    const [ivHex, authTagHex, cipherText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    throw new Error(`Failed to decrypt credential: ${err.message}`);
  }
}

/**
 * Lightweight secure HMAC-SHA256 JWT implementation
 */
export function generateToken(payload: Record<string, any>, expiresInSeconds: number = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken<T = any>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return decodedPayload as T;
  } catch {
    return null;
  }
}

/**
 * Generate cryptographically secure random characters
 */
export function generateRandomCode(length: number = 6, numericOnly: boolean = false): string {
  const chars = numericOnly ? '0123456789' : 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * Memory-based Rate Limiter for sensitive endpoints
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  check(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const timestamps = (this.requests.get(key) || []).filter((time) => now - time < windowMs);

    if (timestamps.length >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return { allowed: true, remaining: maxRequests - timestamps.length };
  }
}

export const rateLimiter = new RateLimiter();
