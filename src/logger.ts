import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";
const pretty = process.stdout.isTTY && process.env.NODE_ENV !== "production";

export const logger = pino({
  level,
  // Never log secrets or personal data. Add paths here as the payloads take shape.
  redact: {
    paths: [
      "*.otp",
      "*.cookie",
      "*.cookies",
      "*.authorization",
      "*.idNumber",
      "*.aadhaar",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[redacted]",
  },
  ...(pretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
});

export type Logger = typeof logger;
