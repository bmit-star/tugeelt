import path from "path";
import dotenv from "dotenv";

dotenv.config();

export interface ServerConfig {
  env: string;
  port: number;
  sessionSecret: string;
  managerPassword: string;
  appScriptUrl: string;
  appScriptSecret: string;
  gpsboxApiUrl: string;
  gpsboxUsername: string;
  gpsboxApiKey: string;
  dbPath: string;
  backupDir: string;
  firebaseProjectId?: string;
  allowedOrigins: string[];
}

const isProd = process.env.NODE_ENV === "production";

export const config: ServerConfig = {
  env: process.env.NODE_ENV || "development",
  port: 3000, // Fixed by container infrastructure
  sessionSecret: process.env.SESSION_SECRET || "fleet-digital-jwt-secret-key-prod-2026-secure-random",
  managerPassword: process.env.MANAGER_PASSWORD || "88051530",
  appScriptUrl: process.env.APP_SCRIPT_URL || "https://script.google.com/macros/s/AKfycby8jM3Zc6Qn7r3Wv8g9xY2k1m4n5p6q7r8s/exec",
  appScriptSecret: process.env.APP_SCRIPT_SECRET || "fleet-gas-hmac-secret-key-production-v1",
  gpsboxApiUrl: process.env.GPSBOX_API_URL || "https://api.gpsbox.mn/api/v1",
  gpsboxUsername: process.env.GPSBOX_USERNAME || "imt_admin",
  gpsboxApiKey: process.env.GPSBOX_API_KEY || "",
  dbPath: process.env.DATABASE_URL || path.join(process.cwd(), "data", "fleet.sqlite"),
  backupDir: path.join(process.cwd(), "data", "backups"),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "telegrambot-453906",
  allowedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.APP_URL || ""
  ].filter(Boolean)
};

// Validate critical configuration on startup
export function validateConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (isProd) {
    if (!process.env.SESSION_SECRET) {
      warnings.push("SESSION_SECRET is using fallback value in production.");
    }
    if (!process.env.APP_SCRIPT_SECRET) {
      warnings.push("APP_SCRIPT_SECRET is using fallback value in production.");
    }
    if (!process.env.MANAGER_PASSWORD) {
      warnings.push("MANAGER_PASSWORD is using fallback value in production.");
    }
  }

  return {
    valid: true,
    warnings
  };
}
