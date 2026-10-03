/**
 * Asia/Ulaanbaatar (UTC+8) Timezone Utilities
 * All business operations, daily boundaries (06:00 - 23:59),
 * and dates must strictly align with Ulaanbaatar local time.
 */

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

export function ubNow(): Date {
  return new Date(Date.now() + UB_OFFSET_MS);
}

export function ubToday(): string {
  return ubNow().toISOString().slice(0, 10);
}

export function ubMonth(): string {
  return ubNow().toISOString().slice(0, 7);
}

export function toUbDateString(dateInput?: string | number | Date): string {
  if (!dateInput) return ubToday();
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return ubToday();
  return new Date(d.getTime() + UB_OFFSET_MS).toISOString().slice(0, 10);
}
