import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./config/database.js";
import { setupSwagger } from "./config/swagger.js";
import apiRoutes from "./routes/index.js";
import { logger } from "./middleware/logger.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { createHandler } from "graphql-http/lib/use/express";
import { schema, rootValue } from "./graphql/schema.js";
import { ensureRedisConnection } from "./config/redis.js";
import { timingMiddleware } from "./middleware/timing.middleware.js";

dotenv.config();

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const isProduction = process.env.NODE_ENV === "production";

let initPromise = null;
export async function ensureServicesReady() {
    if (!initPromise) {
        const tasks = [connectDB()];
        if (process.env.NODE_ENV !== "test") {
            tasks.push(ensureRedisConnection());
        }
        initPromise = Promise.all(tasks).catch((err) => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

export function createApp() {
    const app = express();

    // Trust Vercel / reverse-proxy headers (x-forwarded-proto, x-forwarded-host)
    app.set("trust proxy", 1);

    const staticAllowedOrigins = new Set(
        [
            process.env.FRONTEND_URL,
            ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(",") : []),
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
            process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null,
            process.env.VERCEL_PROJECT_PRODUCTION_URL
                ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
                : null,
            ...(!isProduction
                ? ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"]
                : []),
        ]
            .filter(Boolean)
            .map((o) => o.trim())
    );

    app.use(
        cors((req, callback) => {
            const origin = req.header("Origin");
            if (!origin) {
                return callback(null, { origin: true, credentials: true });
            }

            const protocol = req.header("x-forwarded-proto") || req.protocol || "https";
            const host = req.get("host");
            const sameOrigin = host ? `${protocol}://${host}` : null;

            const isAllowed =
                staticAllowedOrigins.has(origin) ||
                (sameOrigin && origin === sameOrigin) ||
                (!isProduction && /^http:\/\/localhost:\d+$/.test(origin));

            if (isAllowed) {
                return callback(null, { origin: true, credentials: true });
            }

            return callback(new Error("Not allowed by CORS"));
        })
    );

    app.use(express.json());
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: true }));
    app.use(timingMiddleware);

    if (!isServerless) {
        app.use("/uploads", express.static(path.resolve("public/uploads")));
    }

    // Ensure database & cache are connected for serverless invocations
    app.use(async (req, res, next) => {
        try {
            await ensureServicesReady();
            next();
        } catch (err) {
            logger.error("Service connection error during request handling:", err);
            return res.status(500).json({
                success: false,
                message: "Database connection failed",
                error: isProduction ? undefined : err.message,
            });
        }
    });

    if (!isProduction || process.env.ENABLE_SWAGGER === "true") {
        setupSwagger(app);
    }

    app.get("/", (req, res) => {
        res.send("Welcome to backend server of Hostelia");
    });

    app.get("/api/health", (req, res) => {
        res.status(200).json({ success: true, status: "ok" });
    });

    app.all(
        "/api/graphql",
        authMiddleware,
        createHandler({
            schema,
            rootValue,
            context: (request) => ({
                req: request.raw,
                res: request.context?.res,
                user: request.raw?.user ?? null,
            }),
            graphiql: !isProduction,
        })
    );

    app.use("/api", apiRoutes);

    app.use("*path", (req, res) => {
        logger.error(`Path ${req.originalUrl} does not exist for ${req.method} method`);
        res.status(404).json({
            success: false,
            message: `Path ${req.originalUrl} does not exist for ${req.method} method`,
        });
    });

    app.use((err, req, res, next) => {
        console.error(err);

        const statusCode = err.statusCode || 500;
        const message = err.message || "Something went wrong on the server";

        res.status(statusCode).json({
            success: false,
            message,
        });
    });

    return app;
}

export const app = createApp();

export async function startServer() {
    try {
        await ensureServicesReady();
        logger.info("Connected to MongoDB & Redis");
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        logger.error("Database connection error:", err);
        process.exit(1);
    }
}

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
    startServer();
}

export default app;
