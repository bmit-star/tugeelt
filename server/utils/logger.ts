import crypto from "node:crypto";

export type LogLevel = "info" | "warn" | "error" | "debug";

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "apikey",
  "api_key",
  "sessionsecret",
  "appscriptsecret"
]);

function maskSensitive(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(maskSensitive);
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = "***MASKED***";
    } else if (typeof value === "object") {
      result[key] = maskSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const logger = {
  log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta ? { meta: maskSensitive(meta) } : {})
    };
    if (level === "error") {
      console.error(JSON.stringify(entry));
    } else if (level === "warn") {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  },

  info(message: string, meta?: Record<string, any>) {
    this.log("info", message, meta);
  },

  warn(message: string, meta?: Record<string, any>) {
    this.log("warn", message, meta);
  },

  error(message: string, error?: any, meta?: Record<string, any>) {
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    } : { raw: error };

    this.log("error", message, {
      ...meta,
      errorId: crypto.randomUUID(),
      error: errorDetails
    });
  }
};
