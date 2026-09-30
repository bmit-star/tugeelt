import { Router, Request, Response } from "express";
import { TripRepository, TripEntity } from "../../database/repositories/trip.repository";
import { OdoService } from "../telemetry/odo.service";
import { requireAuth, requireRole, requirePermission, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { lockManager } from "../../database/client";
import { logger } from "../../utils/logger";

export const tripRouter = Router();

// Get Trips list (Filtered by driver role if logged in as driver)
tripRouter.get("/", requireAuth(), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const { date, driverId, vehicle, status } = req.query as Record<string, string>;

  // If driver, force driverId filter to their own ID
  const effectiveDriverId = user.role === "driver" ? user.driverId : driverId;

  const trips = TripRepository.findAll({
    date,
    driverId: effectiveDriverId,
    vehicle,
    status
  });

  res.json(trips);
});

// Create / Start a Trip
tripRouter.post("/", requireAuth(), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const body = req.body;

  // IDOR check: if driver, must create for themselves
  const driverId = user.role === "driver" ? user.driverId! : body.driverId;
  const driverName = user.role === "driver" ? user.name : (body.driverName || "Жолооч");

  if (!driverId) {
    return res.status(400).json({ error: "Жолоочийн ID шаардлагатай." });
  }

  const startOdo = Number(body.startOdo);
  const odoValidation = OdoService.validateAndCalculateTripOdo(startOdo, null);
  if (!odoValidation.isValid) {
    return res.status(400).json({ error: odoValidation.message });
  }

  const tripId = body.id || `trip_${Date.now()}_${driverId}`;
  const newTrip: TripEntity = {
    id: tripId,
    date: body.date || new Date().toISOString().slice(0, 10),
    driverId,
    driverName,
    vehicleNumber: body.vehicleNumber || user.vehiclePlate || "",
    salesRep: body.salesRep || "",
    zone: body.zone || "",
    startOdo,
    status: "pending",
    odoCalculationStatus: "pending",
    routeNote: body.routeNote || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  TripRepository.save(newTrip);
  logger.info("New trip created", { tripId, driverId, startOdo });

  res.json({ success: true, trip: newTrip });
});

// Complete a Trip
tripRouter.post("/complete", requireAuth(), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const { tripId, endOdo, fuelLiters, fuelCost, fuelStation, fuelReceiptNo, routeNote } = req.body;

  if (!tripId) {
    return res.status(400).json({ error: "tripId шаардлагатай." });
  }

  // Acquire concurrency lock on the specific trip
  const result = await lockManager.acquire(`trip:${tripId}`, async () => {
    const trip = TripRepository.findById(tripId);
    if (!trip) {
      return { status: 404, data: { error: "Аялал олдсонгүй." } };
    }

    // IDOR check: drivers can only complete their own trips
    if (user.role === "driver" && trip.driverId !== user.driverId) {
      return { status: 403, data: { error: "Та зөвхөн өөрийн аяллыг дуусгах эрхтэй." } };
    }

    const endOdoNum = Number(endOdo);
    const odoCalc = OdoService.validateAndCalculateTripOdo(trip.startOdo, endOdoNum);

    if (!odoCalc.isValid) {
      return { status: 400, data: { error: odoCalc.message } };
    }

    const updatedTrip: TripEntity = {
      ...trip,
      endOdo: endOdoNum,
      totalKm: odoCalc.totalKm,
      status: "completed",
      odoCalculationStatus: odoCalc.status,
      fuelLiters: fuelLiters !== undefined ? Number(fuelLiters) : trip.fuelLiters,
      fuelCost: fuelCost !== undefined ? Number(fuelCost) : trip.fuelCost,
      fuelStation: fuelStation || trip.fuelStation,
      fuelReceiptNo: fuelReceiptNo || trip.fuelReceiptNo,
      routeNote: routeNote || trip.routeNote,
      updatedAt: new Date().toISOString()
    };

    TripRepository.save(updatedTrip);
    logger.info("Trip completed successfully", { tripId, totalKm: odoCalc.totalKm, status: odoCalc.status });

    return { status: 200, data: { success: true, trip: updatedTrip } };
  });

  res.status(result.status).json(result.data);
});

// Manual ODO Override (Manager / Admin only)
tripRouter.post(
  "/:id/manual-override",
  requireAuth(),
  requireRole("admin", "manager"),
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const tripId = req.params.id;
    const { startOdo, endOdo, reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({ error: "Гараар засах үндэслэл, тайлбарыг (доод тал нь 5 тэмдэгт) бичнэ үү." });
    }

    const trip = TripRepository.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: "Аялал олдсонгүй." });
    }

    const newStartOdo = startOdo !== undefined ? Number(startOdo) : trip.startOdo;
    const newEndOdo = endOdo !== undefined ? Number(endOdo) : trip.endOdo;

    const odoCalc = OdoService.validateAndCalculateTripOdo(newStartOdo, newEndOdo, {
      isManualOverride: true,
      overrideReason: reason
    });

    if (!odoCalc.isValid) {
      return res.status(400).json({ error: odoCalc.message });
    }

    const oldValues = { start: trip.startOdo, end: trip.endOdo, totalKm: trip.totalKm };
    const newValues = { start: newStartOdo, end: newEndOdo, totalKm: odoCalc.totalKm };

    const updatedTrip: TripEntity = {
      ...trip,
      startOdo: newStartOdo,
      endOdo: newEndOdo,
      totalKm: odoCalc.totalKm,
      odoCalculationStatus: "manual_override",
      manualOverrideReason: reason,
      manualOverrideBy: authReq.user?.name || "Manager",
      manualOverrideAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    TripRepository.save(updatedTrip);

    // Audit log
    OdoService.logManualOverride(
      tripId,
      authReq.user?.name || "Manager",
      oldValues,
      newValues,
      reason,
      req.ip,
      authReq.requestId
    );

    res.json({ success: true, trip: updatedTrip });
  }
);
