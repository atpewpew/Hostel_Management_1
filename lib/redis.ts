import { Redis } from "@upstash/redis";

/**
 * Upstash Redis client instance.
 * Supports UPSTASH_REDIS_REST_* or Vercel KV_REST_API_* environment variables.
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "",
});

export default redis;
