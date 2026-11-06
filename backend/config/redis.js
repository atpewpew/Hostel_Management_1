import Redis from "ioredis";
import { logger } from "../middleware/logger.js";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisClient = null;
let connected = false;

try {
  redisClient = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
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

export async function ensureRedisConnection() {
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
