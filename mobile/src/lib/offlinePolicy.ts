export const OFFLINE_TTL = 7 * 24 * 60 * 60 * 1000;
export function offlineValid(validatedAt: number, now = Date.now()) {
  return (
    Number.isFinite(validatedAt) &&
    now >= validatedAt &&
    now - validatedAt < OFFLINE_TTL
  );
}
export function scopeId(user: { _id: string; tenantId: string }) {
  if (
    !/^[a-f0-9]{24}$/i.test(user._id) ||
    !/^[a-f0-9]{24}$/i.test(user.tenantId)
  )
    throw new Error("Identidad de sesión inválida.");
  return user.tenantId + "." + user._id;
}
