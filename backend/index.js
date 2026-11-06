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

export function createApp() {
    const app = express();

    const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:5173,http://localhost:5174,http://localhost:3000")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (
                    allowedOrigins.includes(origin) ||
                    /^http:\/\/localhost:\d+$/.test(origin)
                ) {
                    return callback(null, true);
                }
                return callback(new Error("Not allowed by CORS"));
            },
            credentials: true,
        })
    );
    app.use(express.json());
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: true }));
    app.use(timingMiddleware);
    app.use("/uploads", express.static(path.resolve("public/uploads")));

    setupSwagger(app);

    app.get("/", (req, res) => {
        res.send("Welcome to backend server of Hostelia");
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
            graphiql: process.env.NODE_ENV !== "production",
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
        await connectDB();
        logger.info("Connected to MongoDB");
        await ensureRedisConnection();
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        logger.error("Database connection error:", err);
        process.exit(1);
    }
}

if (process.env.NODE_ENV !== "test") {
    startServer();
}
