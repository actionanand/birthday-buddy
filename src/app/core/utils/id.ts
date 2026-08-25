export function createId(): string {
  return globalThis.crypto.randomUUID();
}

export function stableNotificationId(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash || 1) % 2_000_000_000;
}
