import * as crypto from 'crypto';

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseTtl(ttl: string): number {
  const unit = ttl.slice(-1);
  const value = parseInt(ttl.slice(0, -1), 10);
  const multipliers: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  if (!multipliers[unit] || isNaN(value)) {
    throw new Error(`Invalid TTL format: "${ttl}". Expected format: 15m, 2h, 30d`);
  }
  return value * multipliers[unit];
}
