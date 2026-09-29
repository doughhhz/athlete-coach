/**
 * Idempotency key for one user-initiated analysis (UUID v4). It is not an
 * authority: the backend validates it and scopes it to the athlete; a retry of
 * the same question reuses it so no duplicate proposal is created.
 */
export function newAnalysisRequestId(): string {
  const native = globalThis.crypto?.randomUUID?.();
  if (native) return native;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}
