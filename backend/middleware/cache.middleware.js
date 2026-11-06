import crypto from "crypto";
import { getRedisClient, isRedisReady } from "../config/redis.js";
import { logger } from "./logger.js";

function buildCacheKey(req, namespace) {
  const collegeId = req.user?.collegeId ? String(req.user.collegeId) : "public";
  const role = req.user?.role || "public";
  const queryHash = crypto
    .createHash("sha1")
    .update(JSON.stringify(req.query || {}))
    .digest("hex");
  return `cache:${namespace}:${collegeId}:${role}:${req.path}:${queryHash}`;
}

export function cacheResponse({ namespace, ttlSeconds }) {
  return async (req, res, next) => {
    if (!isRedisReady()) {
      res.locals.cacheStatus = "BYPASS";
      return next();
    }

    const key = buildCacheKey(req, namespace);
    const redis = getRedisClient();

    try {
      const cached = await redis.get(key);
      if (cached) {
        res.locals.cacheStatus = "HIT";
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (error) {
      logger.warn("Cache read failed, bypassing", { error: error.message, key });
      res.locals.cacheStatus = "BYPASS";
      return next();
    }

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (!isRedisReady() || res.statusCode >= 400) {
        return originalJson(payload);
      }

      redis
        .set(key, JSON.stringify(payload), "EX", ttlSeconds)
        .catch((error) =>
          logger.warn("Cache write failed", { error: error.message, key })
        );

      res.locals.cacheStatus = "MISS";
      return originalJson(payload);
    };

    return next();
  };
}

export async function invalidateCacheByPrefix(prefix) {
  if (!isRedisReady()) {
    return;
  }

  const redis = getRedisClient();
  let cursor = "0";
  try {
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${prefix}*`,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    logger.warn("Cache invalidation failed", { error: error.message, prefix });
  }
}
