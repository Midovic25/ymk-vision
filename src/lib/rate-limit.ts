/**
 * Limiteur de débit en mémoire (fenêtre glissante).
 * Défense de première ligne contre le brute-force et les abus d'API.
 * Note : la mémoire est par isolat ; il s'agit d'un garde-fou, pas d'un quota global.
 */
const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const oldest = hits[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Purge opportuniste pour borner la mémoire.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

export function assertRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  message = "Trop de requêtes. Merci de patienter avant de réessayer.",
): void {
  const r = rateLimit(key, limit, windowMs);
  if (!r.allowed) {
    throw new Error(`${message} (${r.retryAfterSeconds}s)`);
  }
}
