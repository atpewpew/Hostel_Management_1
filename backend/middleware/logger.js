import winston from "winston";
import "winston-daily-rotate-file";

const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

const exceptionHandlers = [];

// File logging is disabled in serverless environments where the filesystem is read-only
if (!isServerless) {
  const combinedTransport = new winston.transports.DailyRotateFile({
    filename: "%DATE%.log",
    frequency: "1D",
    datePattern: "YYYY-MM-DD",
    dirname: "logs/combined",
    maxFiles: "7d",
  });

  const errorTransport = new winston.transports.DailyRotateFile({
    level: "error",
    filename: "%DATE%.log",
    frequency: "1D",
    datePattern: "YYYY-MM-DD",
    dirname: "logs/error",
    maxFiles: "7d",
  });

  transports.push(errorTransport, combinedTransport);
  exceptionHandlers.push(
    new winston.transports.File({ filename: "logs/exceptions.log" })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports,
  ...(exceptionHandlers.length > 0 ? { exceptionHandlers } : {}),
});
