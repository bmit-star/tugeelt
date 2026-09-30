import { Request, Response, NextFunction } from "express";
import { AuthUser, Permission, Role } from "../auth/auth.types";
import { verifySessionToken } from "../auth/token.service";
import { logger } from "../utils/logger";
import crypto from "node:crypto";

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  requestId?: string;
}

// Security Headers Middleware
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Ensure request ID
    const reqId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
    (req as AuthenticatedRequest).requestId = reqId;
    res.setHeader("X-Request-Id", reqId);
    next();
  };
}

// In-memory sliding window rate limiter
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up stale rate limits every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimiter(windowMs = 60 * 1000, maxRequests = 60, prefix = "global") {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${prefix}:${ip}`;
    const now = Date.now();

    const current = rateLimitStore.get(key);
    if (!current || now > current.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      logger.warn("Rate limit exceeded", { ip, path: req.path, prefix });
      return res.status(429).json({
        error: "Хүсэлтийн хязгаар хэтэрлээ. Түр хүлээгээд дахин оролдоно уу.",
        retryAfterMs: current.resetTime - now
      });
    }

    current.count++;
    next();
  };
}

// Authentication Middleware: Verifies Bearer Token
export function requireAuth(optional = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let token = "";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.query.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      if (optional) return next();
      logger.warn("Unauthorized access attempt: missing token", { path: req.path, method: req.method });
      return res.status(401).json({
        error: "Нэвтрэх шаардлагатай (401 Unauthorized). Та системд дахин нэвтэрнэ үү."
      });
    }

    const user = verifySessionToken(token);
    if (!user) {
      if (optional) return next();
      logger.info("Access attempt with expired or invalid token", { path: req.path });
      return res.status(401).json({
        error: "Нэвтрэх токен хүчингүй эсвэл хугацаа нь дууссан байна (401 Unauthorized)."
      });
    }

    (req as AuthenticatedRequest).user = user;
    next();
  };
}

// Role-based Access Control Middleware
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: "Нэвтрэх шаардлагатай (401 Unauthorized)" });
    }

    if (!allowedRoles.includes(authReq.user.role) && authReq.user.role !== "admin") {
      logger.warn("Forbidden access attempt: insufficient role", {
        userId: authReq.user.userId,
        role: authReq.user.role,
        requiredRoles: allowedRoles,
        path: req.path
      });
      return res.status(403).json({
        error: "Энэ үйлдлийг хийх эрх хүрэлцэхгүй байна (403 Forbidden)."
      });
    }

    next();
  };
}

// Permission-based Access Control Middleware
export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: "Нэвтрэх шаардлагатай (401 Unauthorized)" });
    }

    // Admin has all permissions
    if (authReq.user.role === "admin") {
      return next();
    }

    const userPermissions = new Set(authReq.user.permissions);
    const hasAll = requiredPermissions.every((p) => userPermissions.has(p));

    if (!hasAll) {
      logger.warn("Forbidden access attempt: missing permission", {
        userId: authReq.user.userId,
        role: authReq.user.role,
        missing: requiredPermissions.filter((p) => !userPermissions.has(p)),
        path: req.path
      });
      return res.status(403).json({
        error: "Танд уг үйлдлийг гүйцэтгэх тусгай зөвшөөрөл байхгүй байна (403 Forbidden)."
      });
    }

    next();
  };
}

// Resource Ownership & IDOR Protection Middleware
export function requireResourceAccess(resourceType: "trip" | "driver" | "order") {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return res.status(401).json({ error: "Нэвтрэх шаардлагатай" });
    }

    // Admins and Managers have organization-wide access
    if (user.role === "admin" || user.role === "manager" || user.role === "dispatcher") {
      return next();
    }

    // Driver can only access their own resources
    if (user.role === "driver") {
      if (resourceType === "driver") {
        const targetDriverId = req.params.id || req.body.driverId;
        if (targetDriverId && targetDriverId !== user.driverId && targetDriverId !== user.userId) {
          logger.warn("IDOR attempt blocked: driver trying to access another driver", {
            userId: user.userId,
            driverId: user.driverId,
            targetDriverId,
            path: req.path
          });
          return res.status(403).json({
            error: "Та зөвхөн өөрийн бүртгэл болон замын хуудсанд хандах эрхтэй (403 Forbidden)."
          });
        }
      }

      if (resourceType === "trip") {
        const bodyDriverId = req.body.driverId;
        if (bodyDriverId && bodyDriverId !== user.driverId && bodyDriverId !== user.userId) {
          logger.warn("IDOR attempt blocked: driver trying to submit trip for another driver", {
            userId: user.userId,
            driverId: user.driverId,
            bodyDriverId,
            path: req.path
          });
          return res.status(403).json({
            error: "Та өөр жолоочийн нэр дээр аялал/замын хуудас үүсгэх эрхгүй (403 Forbidden)."
          });
        }
      }
    }

    next();
  };
}
