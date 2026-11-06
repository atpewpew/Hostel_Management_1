import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const redisGet = jest.fn();
const redisSet = jest.fn();
const redisScan = jest.fn();
const redisDel = jest.fn();
const getRedisClient = jest.fn();
const isRedisReady = jest.fn();
const logger = { warn: jest.fn() };

await jest.unstable_mockModule("../config/redis.js", () => ({
  getRedisClient,
  isRedisReady,
}));

await jest.unstable_mockModule("../middleware/logger.js", () => ({
  logger,
}));

const { cacheResponse, invalidateCacheByPrefix } = await import("../middleware/cache.middleware.js");

function createReq(overrides = {}) {
  return {
    user: { collegeId: "c1", role: "collegeAdmin" },
    query: {},
    path: "/sample",
    ...overrides,
  };
}

function createRes() {
  return {
    statusCode: 200,
    locals: {},
    payload: null,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(payload) {
      this.payload = payload;
      return this;
    }),
  };
}

describe("cache.middleware unit", () => {
  beforeEach(() => {
    getRedisClient.mockReturnValue({
      get: redisGet,
      set: redisSet,
      scan: redisScan,
      del: redisDel,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("bypasses when redis is not ready", async () => {
    isRedisReady.mockReturnValue(false);
    const mw = cacheResponse({ namespace: "n", ttlSeconds: 60 });
    const req = createReq();
    const res = createRes();
    const next = jest.fn();

    await mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.locals.cacheStatus).toBe("BYPASS");
  });

  it("serves cached response on redis hit", async () => {
    isRedisReady.mockReturnValue(true);
    redisGet.mockResolvedValueOnce(JSON.stringify({ success: true }));

    const mw = cacheResponse({ namespace: "n", ttlSeconds: 60 });
    const req = createReq();
    const res = createRes();
    const next = jest.fn();

    await mw(req, res, next);

    expect(res.locals.cacheStatus).toBe("HIT");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.payload).toEqual({ success: true });
    expect(next).not.toHaveBeenCalled();
  });

  it("bypasses when redis read throws", async () => {
    isRedisReady.mockReturnValue(true);
    redisGet.mockRejectedValueOnce(new Error("read fail"));

    const mw = cacheResponse({ namespace: "n", ttlSeconds: 60 });
    const req = createReq();
    const res = createRes();
    const next = jest.fn();

    await mw(req, res, next);

    expect(res.locals.cacheStatus).toBe("BYPASS");
    expect(next).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("writes cache on miss and skips write for error responses", async () => {
    isRedisReady.mockReturnValue(true);
    redisGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    redisSet.mockResolvedValue("OK");

    const mw = cacheResponse({ namespace: "n", ttlSeconds: 60 });

    const req1 = createReq({ query: { page: "1" } });
    const res1 = createRes();
    const next1 = jest.fn();
    await mw(req1, res1, next1);
    res1.statusCode = 200;
    res1.json({ hello: "world" });
    expect(res1.locals.cacheStatus).toBe("MISS");
    expect(redisSet).toHaveBeenCalled();

    const req2 = createReq({ query: { page: "2" } });
    const res2 = createRes();
    const next2 = jest.fn();
    await mw(req2, res2, next2);
    res2.statusCode = 500;
    res2.json({ error: "x" });
    expect(redisSet).toHaveBeenCalledTimes(1);
  });

  it("builds key with public namespace when req.user is absent", async () => {
    isRedisReady.mockReturnValue(true);
    redisGet.mockResolvedValueOnce(null);
    redisSet.mockResolvedValue("OK");

    const mw = cacheResponse({ namespace: "n", ttlSeconds: 60 });
    const req = createReq({ user: undefined, query: { q: "1" }, path: "/public" });
    const res = createRes();
    const next = jest.fn();

    await mw(req, res, next);
    res.statusCode = 200;
    res.json({ ok: true });

    expect(redisSet).toHaveBeenCalledWith(
      expect.stringContaining("cache:n:public:public:/public:"),
      JSON.stringify({ ok: true }),
      "EX",
      60
    );
  });

  it("logs cache write errors", async () => {
    isRedisReady.mockReturnValue(true);
    redisGet.mockResolvedValueOnce(null);
    redisSet.mockRejectedValueOnce(new Error("write fail"));

    const mw = cacheResponse({ namespace: "n", ttlSeconds: 60 });
    const req = createReq();
    const res = createRes();
    const next = jest.fn();

    await mw(req, res, next);
    res.statusCode = 200;
    res.json({ ok: true });
    await Promise.resolve();

    expect(logger.warn).toHaveBeenCalledWith("Cache write failed", expect.any(Object));
  });

  it("invalidateCacheByPrefix scans and deletes keys; handles errors", async () => {
    isRedisReady.mockReturnValue(true);
    redisScan
      .mockResolvedValueOnce(["1", ["cache:n:1", "cache:n:2"]])
      .mockResolvedValueOnce(["0", []]);
    redisDel.mockResolvedValueOnce(2);

    await invalidateCacheByPrefix("cache:n:");

    expect(redisDel).toHaveBeenCalledWith("cache:n:1", "cache:n:2");

    redisScan.mockRejectedValueOnce(new Error("scan fail"));
    await invalidateCacheByPrefix("cache:n:");
    expect(logger.warn).toHaveBeenCalledWith("Cache invalidation failed", expect.any(Object));
  });
});
