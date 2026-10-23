// Lightweight per-process limiter for small/self-hosted deployments.
// For multiple backend instances, replace this in-memory store with a shared
// limiter store (for example Redis) or enforce equivalent limits at the proxy.
module.exports = function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' }) {
  const buckets = new Map();

  return function limitRequest(req, res, next) {
    const now = Date.now();
    const bucketKey = String(key(req) || req.ip || 'unknown');
    let bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: message });
    }

    // Bound memory if a client rotates addresses/keys.
    if (buckets.size > 10_000) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
      }
      while (buckets.size > 10_000) buckets.delete(buckets.keys().next().value);
    }
    return next();
  };
};
