export function normalizeTenDigitIndianMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function isValidTenDigitIndianMobile(mobile: string): boolean {
  const clean = normalizeTenDigitIndianMobile(mobile);
  return /^[6-9]\d{9}$/.test(clean);
}

export type PinValidationErrorCode = 'INVALID_PIN_FORMAT' | 'PIN_MISMATCH';

export type PinValidationResult =
  | { ok: true; cleanPin: string }
  | { ok: false; code: PinValidationErrorCode };

export function validateSecurityPin(pin: string, confirmPin?: string): PinValidationResult {
  const trimmed = (pin || '').trim();
  if (!/^\d{4,6}$/.test(trimmed)) {
    return { ok: false, code: 'INVALID_PIN_FORMAT' };
  }
  if (confirmPin !== undefined && confirmPin.trim() !== trimmed) {
    return { ok: false, code: 'PIN_MISMATCH' };
  }
  return { ok: true, cleanPin: trimmed };
}

export async function hashTestPin(mobile10: string, pin: string): Promise<string> {
  const cleanPin = pin.trim() || '1234';
  const payload = `rojgar_setu_demo:${mobile10}:${cleanPin}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const encoded = new TextEncoder().encode(payload);
    const digest = await subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
  }
  return `pin_${hash.toString(16)}`;
}
