/**
 * Numeric sanitization and integer rounding utilities for Odometer and KM
 */

export function toIntKm(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "").trim());
  if (!Number.isFinite(num)) return 0;
  return Math.round(num);
}

export function toIntKmOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "").trim());
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

export function toLiters(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "").trim());
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 10) / 10;
}
