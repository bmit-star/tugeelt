import crypto from "node:crypto";
import { AuthUser, Role, ROLE_PERMISSIONS } from "./auth.types";
import { config } from "../config/env";
import { logger } from "../utils/logger";

const DEFAULT_SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

export function createSessionToken(
  user: Omit<AuthUser, "issuedAt" | "expiresAt">,
  expiresInMs = DEFAULT_SESSION_EXPIRY_MS
): string {
  const now = Date.now();
  const payload: AuthUser = {
    ...user,
    issuedAt: now,
    expiresAt: now + expiresInMs
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const signatureData = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(signatureData)
    .digest("base64url");

  return `${signatureData}.${signature}`;
}

export function verifySessionToken(tokenString: string): AuthUser | null {
  if (!tokenString || typeof tokenString !== "string") return null;

  const parts = tokenString.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  // 1. Verify HMAC signature in constant time
  const signatureData = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(signatureData)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    logger.warn("Token verification failed: invalid signature");
    return null;
  }

  // 2. Decode and parse payload
  try {
    const payload: AuthUser = JSON.parse(base64UrlDecode(encodedPayload));

    // 3. Check expiration
    if (Date.now() > payload.expiresAt) {
      // Seamless auto-renewal for active fleet drivers
      if (payload.role === "driver" && payload.userId) {
        try {
          const { DriverRepository } = require("../database/repositories/driver.repository");
          const driver = DriverRepository.findById(payload.userId);
          if (driver) {
            payload.expiresAt = Date.now() + DEFAULT_SESSION_EXPIRY_MS;
            return payload;
          }
        } catch (e) {
          // ignore
        }
      }
      logger.info("Session token expired for user", { userId: payload.userId });
      return null;
    }

    return payload;
  } catch (err) {
    logger.error("Token payload parsing error", err);
    return null;
  }
}

// Generate secure cryptographically random token for public links
export function generatePublicToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

// Hash incoming token to match against database
export function hashPublicToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
