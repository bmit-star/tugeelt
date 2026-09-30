import { Router, Request, Response } from "express";
import { DriverRepository } from "../../database/repositories/driver.repository";
import { createSessionToken } from "../../auth/token.service";
import { ROLE_PERMISSIONS, Role } from "../../auth/auth.types";
import { config } from "../../config/env";
import { logger } from "../../utils/logger";
import { AuthenticatedRequest, requireAuth } from "../../middleware/auth.middleware";

export const authRouter = Router();

// Driver Login
authRouter.post("/driver-login", (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Жолоочийн код шаардлагатай." });
  }

  const cleanCode = code.trim();
  const driver = DriverRepository.findById(cleanCode);

  if (!driver) {
    logger.warn("Driver login failed: code not found", { code: cleanCode });
    return res.status(401).json({ error: "Жолоочийн код буруу байна." });
  }

  // Generate verified Driver Session Token
  const token = createSessionToken({
    userId: driver.id,
    driverId: driver.id,
    vehiclePlate: driver.vehicle,
    name: driver.name,
    role: "driver",
    permissions: ROLE_PERMISSIONS.driver
  });

  logger.info("Driver logged in successfully", { driverId: driver.id, name: driver.name });

  res.json({
    success: true,
    token,
    user: {
      userId: driver.id,
      driverId: driver.id,
      name: driver.name,
      vehicle: driver.vehicle,
      role: "driver",
      permissions: ROLE_PERMISSIONS.driver
    }
  });
});

// Manager Login
authRouter.post("/manager-login", (req: Request, res: Response) => {
  const { password, code } = req.body;
  const inputCode = String(password || code || "").trim();

  if (!inputCode) {
    return res.status(400).json({ error: "Менежерийн нууц код шаардлагатай." });
  }

  // Constant-time check or direct match against configured password
  if (inputCode !== config.managerPassword) {
    logger.warn("Manager login failed: incorrect password");
    return res.status(401).json({ error: "Менежерийн код буруу байна." });
  }

  // Generate verified Manager Session Token
  const token = createSessionToken({
    userId: "manager_system",
    name: "Системийн Менежер",
    role: "manager",
    permissions: ROLE_PERMISSIONS.manager
  });

  logger.info("Manager logged in successfully");

  res.json({
    success: true,
    token,
    user: {
      userId: "manager_system",
      name: "Системийн Менежер",
      role: "manager",
      permissions: ROLE_PERMISSIONS.manager
    }
  });
});

// Current User Profile
authRouter.get("/me", requireAuth(), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  res.json({
    success: true,
    user: authReq.user
  });
});

// Logout endpoint
authRouter.post("/logout", (req: Request, res: Response) => {
  res.json({ success: true, message: "Амжилттай гарлаа." });
});
