import { AuditRepository } from "../../database/repositories/audit.repository";
import { logger } from "../../utils/logger";

export type OdoSource = "gpsbox" | "manual" | "system";

export interface OdoReading {
  value: number;
  source: OdoSource;
  recordedAt: string;
  receivedAt: string;
  deviceId?: string;
  confidence: "high" | "medium" | "low";
}

export type OdoCalculationStatus =
  | "pending"
  | "valid"
  | "invalid"
  | "manual_override"
  | "requires_review";

export interface OdoValidationResult {
  isValid: boolean;
  status: OdoCalculationStatus;
  totalKm: number;
  message?: string;
}

export interface TelemetryFreshnessResult {
  status: "fresh" | "stale" | "offline" | "invalid";
  ageMinutes: number;
  lastUpdate: string;
}

const MAX_REASONABLE_DAILY_KM = 1500; // Trips exceeding 1,500 km per day require manager review

export class OdoService {
  /**
   * Calculate and validate totalKm from start and end ODO readings
   */
  static validateAndCalculateTripOdo(
    startOdo: number,
    endOdo?: number | null,
    options?: { isManualOverride?: boolean; overrideReason?: string }
  ): OdoValidationResult {
    // 1. Check start ODO
    if (isNaN(startOdo) || startOdo <= 0) {
      return {
        isValid: false,
        status: "invalid",
        totalKm: 0,
        message: "Эхлэх одометрийн заалт 0-ээс их эерэг тоо байх ёстой."
      };
    }

    // 2. Pending trip if end ODO not yet provided
    if (endOdo === undefined || endOdo === null) {
      return {
        isValid: true,
        status: "pending",
        totalKm: 0,
        message: "Аялал явагдаж байна (дуусах ODO бүртгэгдээгүй)."
      };
    }

    // 3. Reject negative end ODO
    if (isNaN(endOdo) || endOdo <= 0) {
      return {
        isValid: false,
        status: "invalid",
        totalKm: 0,
        message: "Төгсгөлийн одометрийн заалт буруу байна."
      };
    }

    // 4. Reject end ODO < start ODO
    if (endOdo < startOdo) {
      return {
        isValid: false,
        status: "invalid",
        totalKm: 0,
        message: `Төгсгөлийн ODO (${endOdo}) нь эхлэх ODO (${startOdo})-оос бага байж болохгүй.`
      };
    }

    const diffKm = Math.round((endOdo - startOdo) * 10) / 10;

    // 5. Handle manual override
    if (options?.isManualOverride) {
      return {
        isValid: true,
        status: "manual_override",
        totalKm: diffKm,
        message: options.overrideReason || "Гараар баталгаажуулсан ODO зөрүү."
      };
    }

    // 6. Suspiciously large jump check
    if (diffKm > MAX_REASONABLE_DAILY_KM) {
      logger.warn("Unusually large trip ODO detected", { startOdo, endOdo, diffKm });
      return {
        isValid: true,
        status: "requires_review",
        totalKm: diffKm,
        message: `Өдрийн гүйлт ${diffKm} км нь зөвшөөрөгдөх хэмжээнээс өндөр байна. Менежерийн хяналт шаардлагатай.`
      };
    }

    return {
      isValid: true,
      status: "valid",
      totalKm: diffKm
    };
  }

  /**
   * Determine telemetry freshness
   */
  static assessFreshness(lastUpdateIso?: string): TelemetryFreshnessResult {
    if (!lastUpdateIso) {
      return { status: "offline", ageMinutes: Infinity, lastUpdate: "" };
    }

    const updateTime = new Date(lastUpdateIso).getTime();
    if (isNaN(updateTime)) {
      return { status: "invalid", ageMinutes: Infinity, lastUpdate: lastUpdateIso };
    }

    const now = Date.now();
    const ageMinutes = Math.floor((now - updateTime) / (60 * 1000));

    if (ageMinutes < 30) {
      return { status: "fresh", ageMinutes, lastUpdate: lastUpdateIso };
    } else if (ageMinutes < 360) {
      return { status: "stale", ageMinutes, lastUpdate: lastUpdateIso };
    } else {
      return { status: "offline", ageMinutes, lastUpdate: lastUpdateIso };
    }
  }

  /**
   * Sanitize numeric fuel value
   */
  static parseNumericFuel(rawFuel: any): { liters?: number; percent?: number; cleanStr: string } {
    if (rawFuel === null || rawFuel === undefined) {
      return { cleanStr: "—" };
    }

    if (typeof rawFuel === "number") {
      return { liters: rawFuel, cleanStr: `${rawFuel} л` };
    }

    const str = String(rawFuel).trim();
    if (str === "—" || str === "" || str === "0" || str === "0.0 л") {
      return { cleanStr: str || "—" };
    }

    // Check if percentage (e.g. "75%")
    if (str.includes("%")) {
      const p = parseFloat(str.replace("%", "").trim());
      return { percent: isNaN(p) ? undefined : p, cleanStr: str };
    }

    // Extract numeric liters
    const match = str.match(/([0-9.]+)/);
    if (match) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) {
        return { liters: num, cleanStr: `${num} л` };
      }
    }

    return { cleanStr: str };
  }

  /**
   * Record manual ODO override audit log
   */
  static logManualOverride(
    tripId: string,
    user: string,
    oldOdo: { start?: number; end?: number; totalKm?: number },
    newOdo: { start?: number; end?: number; totalKm?: number },
    reason: string,
    ip = "",
    requestId = ""
  ) {
    AuditRepository.log(
      user,
      "TRIP_ODO_MANUAL_OVERRIDE",
      `Аялал #${tripId} ODO заалтыг гараар шинэчлэв: ${oldOdo.totalKm ?? 0}км -> ${newOdo.totalKm ?? 0}км. Шалтгаан: ${reason}`,
      oldOdo,
      newOdo,
      ip,
      requestId
    );
  }
}
