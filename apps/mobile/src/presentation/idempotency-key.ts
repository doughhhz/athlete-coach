/**
 * Idempotency key (UUID v4) for one user intent: one analysis request or one
 * new-program creation. It is identity only, never authority: the backend
 * validates it and scopes it to the athlete. Every retry of the same intent
 * reuses the same key, so no duplicate is created.
 */
export function newIdempotencyKey(): string {
  const native = globalThis.crypto?.randomUUID?.();
  if (native) return native;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}
