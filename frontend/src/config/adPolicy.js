/** Environment variables alone must never enable advertising. */
export const AD_POLICY = Object.freeze({
  enabled: false,
  approved: false,
  publisher: 'ca-pub-1077407420035302',
  reviewedPaths: Object.freeze([]),
});

export function isAdEligible({ pathname, user = null, authLoading = true, consent = 'unknown', contentReady = false, client, slot } = {}, policy = AD_POLICY) {
  if (!policy.enabled || !policy.approved || authLoading || !contentReady) return false;
  if (consent !== 'granted' || client !== policy.publisher || !/^\d+$/.test(slot || '')) return false;
  if (user) {
    const plans = [user.plan, user.tenant?.plan].filter(Boolean);
    if (!plans.length || plans.some(plan => plan !== 'free') || user.esSuperAdmin) return false;
  }
  if (typeof pathname !== 'string' || !/^\/(academia|tutoriales)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname)) return false;
  return policy.reviewedPaths.includes(pathname);
}
