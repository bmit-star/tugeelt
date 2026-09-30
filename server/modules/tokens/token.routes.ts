import { Router, Request, Response } from "express";
import { PublicTokenRepository } from "../../database/repositories/token.repository";
import { IMDRepository } from "../../database/repositories/imd.repository";
import { requireAuth, requireRole, rateLimiter, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { logger } from "../../utils/logger";

export const tokenRouter = Router();

// Create new public share token (Manager / Admin only)
tokenRouter.post(
  "/tokens/create",
  requireAuth(),
  requireRole("admin", "manager", "dispatcher"),
  (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { scope, resourceType, resourceId, expiresInDays } = req.body;

    if (!scope || !resourceType || !resourceId) {
      return res.status(400).json({ error: "scope, resourceType, resourceId талбарууд шаардлагатай." });
    }

    const expiresInMs = (Number(expiresInDays) || 7) * 24 * 60 * 60 * 1000;
    const { rawToken, record } = PublicTokenRepository.createToken(
      scope,
      resourceType,
      resourceId,
      authReq.user?.name || "manager",
      expiresInMs
    );

    res.json({
      success: true,
      token: rawToken,
      shareUrl: `/invite/${rawToken}`,
      expiresAt: new Date(record.expiresAt).toISOString()
    });
  }
);

// Revoke a public share token (Manager / Admin only)
tokenRouter.post(
  "/tokens/revoke",
  requireAuth(),
  requireRole("admin", "manager"),
  (req: Request, res: Response) => {
    const { tokenId } = req.body;
    if (!tokenId) {
      return res.status(400).json({ error: "tokenId шаардлагатай." });
    }

    const success = PublicTokenRepository.revokeToken(tokenId);
    res.json({ success, message: success ? "Токен амжилттай цуцлагдлаа." : "Токен олдсонгүй." });
  }
);

// Public Order Access (Hardened, Rate-limited, Token-hash checked, Sanitized response)
tokenRouter.get(
  "/public/orders/:token",
  rateLimiter(60 * 1000, 30, "public_order"),
  (req: Request, res: Response) => {
    const rawToken = req.params.token;
    if (!rawToken || rawToken.length < 16) {
      return res.status(400).json({ error: "Хүчингүй токен (хэт богино эсвэл буруу формат)." });
    }

    // 1. Verify token cryptographically
    const tokenRecord = PublicTokenRepository.verifyToken(rawToken, "imd_order_view");
    if (!tokenRecord) {
      return res.status(404).json({
        error: "Урилга / Захиалгын холбоос хүчингүй эсвэл хугацаа нь дууссан байна (404 Not Found)."
      });
    }

    // 2. Fetch the associated order
    const order = IMDRepository.findOrderById(tokenRecord.resourceId);
    if (!order) {
      return res.status(404).json({ error: "Холбогдох захиалга олдсонгүй." });
    }

    // 3. Find assignment if any
    let assignment = null;
    if (order.assignmentId) {
      assignment = IMDRepository.findAssignmentById(order.assignmentId);
    }

    // 4. Return STRICTLY SANITIZED public view (no internal telemetry, no fuel, no credentials)
    const sanitizedView = {
      orderNo: order.orderNo,
      customer: order.customer,
      customerOrg: order.customerOrg || "",
      destination: order.destination,
      province: order.province,
      status: order.status,
      receivedDate: order.receivedDate,
      deliveryDate: order.deliveryDate,
      vehicle: assignment ? assignment.vehiclePlate : undefined,
      driverName: assignment ? assignment.primaryDriverName : undefined,
      departureDate: assignment ? assignment.departureDate : undefined
    };

    logger.info("Public order viewed via token", {
      orderNo: order.orderNo,
      accessCount: tokenRecord.accessCount
    });

    res.json({
      success: true,
      order: sanitizedView
    });
  }
);
