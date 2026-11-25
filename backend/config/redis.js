import Redis from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";
import dotenv from "dotenv";
import { logger } from "../middleware/logger.js";

dotenv.config();

let redisClient = null;
let connected = false;
let clientType = null; // "rest" | "tcp"

function getRestConfig() {
  const url = (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ""
  ).trim();
  const token = (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    ""
  ).trim();
  return url && token ? { url, token } : null;
}

function getTcpUrl() {
  return (process.env.REDIS_URL || process.env.KV_URL || "").trim();
}

function createRestAdapter(url, token) {
  const rest = new UpstashRedis({
    url,
    token,
    automaticDeserialization: false,
  });

  return {
    async ping() {
      return rest.ping();
    },
    async get(key) {
      return rest.get(key);
    },
    async set(key, value, mode, ttl) {
      if (typeof mode === "string" && mode.toUpperCase() === "EX" && ttl !== undefined) {
        return rest.set(key, value, { ex: Number(ttl) });
      }
      return rest.set(key, value);
    },
    async scan(cursor, _matchKeyword, pattern, _countKeyword, count) {
      return rest.scan(cursor, {
        match: pattern,
        count: Number(count) || 100,
      });
    },
    async del(...keys) {
      if (keys.length === 0) return 0;
      return rest.del(...keys);
    },
  };
}

function initRedisClient() {
  if (redisClient) return redisClient;

  // Prefer Upstash REST client (stateless HTTPS — optimal for Vercel serverless & local dev)
  const restConfig = getRestConfig();
  if (restConfig) {
    try {
      redisClient = createRestAdapter(restConfig.url, restConfig.token);
      clientType = "rest";
      return redisClient;
    } catch (error) {
      logger.warn("Upstash REST Redis initialization failed, cache disabled", {
        error: error.message,
      });
    }
  }

  // Fallback to TCP ioredis client when REDIS_URL / KV_URL is provided
  const redisUrl = getTcpUrl();
  if (!redisUrl) return null;

  try {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    clientType = "tcp";

    redisClient.on("connect", () => {
      connected = true;
      logger.info("Redis connected via TCP/TLS");
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

  return redisClient;
}

export async function ensureRedisConnection() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const restConfig = getRestConfig();
  const tcpUrl = getTcpUrl();

  if (!restConfig && !tcpUrl) {
    logger.info(
      "Redis cache disabled (no Upstash REST or REDIS_URL configured). Serving queries directly from MongoDB."
    );
    return;
  }

  const client = initRedisClient();
  if (!client || connected) {
    return;
  }

  try {
    if (clientType === "rest") {
      await client.ping();
      connected = true;
      logger.info("Upstash Redis connected via REST API");
    } else {
      await client.connect();
    }
  } catch (error) {
    connected = false;
    logger.warn("Failed to connect Redis, continuing without cache", {
      error: error.message,
    });
  }
}

export function getRedisClient() {
  if (!redisClient) {
    initRedisClient();
  }
  return redisClient;
}

export function isRedisReady() {
  return Boolean(redisClient) && connected;
}
