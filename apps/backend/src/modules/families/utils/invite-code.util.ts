import * as crypto from 'crypto';

// 32-char alphabet: excludes 0/O and 1/I to avoid visual confusion.
// 32 = 2^5, so byte % 32 is perfectly uniform (256 = 8 × 32, no modulo bias).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[bytes[i] % 32];
  }
  return code;
}
