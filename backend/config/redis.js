import Redis from "ioredis";
import { logger } from "../middleware/logger.js";

const redisUrl = process.env.REDIS_URL?.trim();

let redisClient = null;
let connected = false;

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

    redisClient.on("connect", () => {
      connected = true;
      logger.info("Redis connected");
    });

    redisClient.on("close", () => {
      connected = false;
      logger.warn("Redis connection closed");
    });

    redisClient.on("error", (error) => {
      connected = false;
      logger.warn("Redis error, cache will be bypassed", { error: error.message });
    });
  } catch (error) {
    logger.warn("Redis initialization failed, cache disabled", { error: error.message });
  }
}

export async function ensureRedisConnection() {
  if (!redisUrl) {
    logger.info("Redis cache disabled (REDIS_URL not configured). Serving queries directly from MongoDB.");
    return;
  }

  if (!redisClient || connected) {
    return;
  }

  try {
    await redisClient.connect();
  } catch (error) {
    logger.warn("Failed to connect Redis, continuing without cache", {
      error: error.message,
    });
  }
}

export function getRedisClient() {
  return redisClient;
}

export function isRedisReady() {
  return Boolean(redisClient) && connected;
}
