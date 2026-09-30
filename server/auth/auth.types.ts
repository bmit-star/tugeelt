export type Role =
  | "admin"
  | "manager"
  | "dispatcher"
  | "driver"
  | "viewer"
  | "customer";

export type Permission =
  | "drivers.read"
  | "drivers.write"
  | "vehicles.read"
  | "vehicles.write"
  | "trips.read"
  | "trips.write"
  | "trips.complete"
  | "trips.approve"
  | "telemetry.read"
  | "fuel.write"
  | "reports.export"
  | "imd.manage"
  | "backup.create"
  | "backup.restore";

export interface AuthUser {
  userId: string;
  role: Role;
  permissions: Permission[];
  driverId?: string;
  vehiclePlate?: string;
  name: string;
  email?: string;
  issuedAt: number;
  expiresAt: number;
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "drivers.read",
    "drivers.write",
    "vehicles.read",
    "vehicles.write",
    "trips.read",
    "trips.write",
    "trips.complete",
    "trips.approve",
    "telemetry.read",
    "fuel.write",
    "reports.export",
    "imd.manage",
    "backup.create",
    "backup.restore"
  ],
  manager: [
    "drivers.read",
    "drivers.write",
    "vehicles.read",
    "vehicles.write",
    "trips.read",
    "trips.write",
    "trips.complete",
    "trips.approve",
    "telemetry.read",
    "fuel.write",
    "reports.export",
    "imd.manage",
    "backup.create",
    "backup.restore"
  ],
  dispatcher: [
    "drivers.read",
    "vehicles.read",
    "trips.read",
    "trips.write",
    "telemetry.read",
    "fuel.write",
    "reports.export",
    "imd.manage"
  ],
  driver: [
    "trips.read",
    "trips.write",
    "trips.complete",
    "telemetry.read",
    "fuel.write"
  ],
  viewer: [
    "drivers.read",
    "vehicles.read",
    "trips.read",
    "telemetry.read",
    "reports.export"
  ],
  customer: []
};
