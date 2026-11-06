import { logger } from "./logger.js";

export function timingMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;

    logger.info("Request timing", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      cache: res.locals.cacheStatus || "BYPASS",
    });
  });

  next();
}
