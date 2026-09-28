import { format as dateFnsFormat } from "date-fns";

/**
 * Parses a date or timestamp from Supabase / PostgreSQL (which stores in UTC)
 * into a JavaScript Date object in the client's local timezone.
 *
 * Rules:
 * 1. If it's already a Date object, return it.
 * 2. If it's a date-only string ('YYYY-MM-DD'), parse as local midnight.
 * 3. If it's a timestamp string without explicit timezone (e.g. '2026-09-22T06:26:29' or '2026-09-22 06:26:29' from database),
 *    treat it as UTC (append 'Z') so the browser automatically converts it to the user's local timezone (e.g. UTC+8 -> 14:26:29 / 2:26:29 PM).
 */
export function parseClientDate(dateInput?: string | Date | null): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }

  const s = String(dateInput).trim();
  if (!s) return new Date();

  // If date-only 'YYYY-MM-DD'
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // If explicit timezone offset (+08:00 or -05:00) or Z
  if (s.endsWith("Z") || s.endsWith("z") || /[+-]\d{2}(:\d{2})?$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  // Database timestamps (PostgreSQL / Supabase) are stored in UTC without 'Z' suffix.
  // We treat them as UTC so the browser converts them to the client local timezone.
  const isoLike = s.replace(" ", "T");
  const utcDate = new Date(`${isoLike}Z`);
  if (!isNaN(utcDate.getTime())) {
    return utcDate;
  }

  // Fallback direct Date parse
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Formats a date/time to local client time string (e.g. "02:28:34 PM" or "14:28:34").
 */
export function formatClientTime(
  dateInput?: string | Date | null,
  options: { hour12?: boolean; includeSeconds?: boolean } = { hour12: true, includeSeconds: true }
): string {
  if (!dateInput) return "-";
  const d = parseClientDate(dateInput);
  if (isNaN(d.getTime())) return "-";

  const { hour12 = true, includeSeconds = true } = options;
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12,
  });
}

/**
 * Formats a date to local client date string (e.g. "Jul 28, 2026").
 */
export function formatClientDate(
  dateInput?: string | Date | null,
  formatStr = "MMM dd, yyyy"
): string {
  if (!dateInput) return "-";
  const d = parseClientDate(dateInput);
  if (isNaN(d.getTime())) return "-";
  try {
    return dateFnsFormat(d, formatStr);
  } catch {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
}

/**
 * Formats a date/time to "MMM dd, HH:mm:ss" in client local time.
 */
export function formatClientDateTime(
  dateInput?: string | Date | null,
  formatStr = "MMM dd, HH:mm:ss"
): string {
  if (!dateInput) return "-";
  const d = parseClientDate(dateInput);
  if (isNaN(d.getTime())) return "-";
  try {
    return dateFnsFormat(d, formatStr);
  } catch {
    return `${formatClientDate(d)} ${formatClientTime(d)}`;
  }
}

/**
 * Converts a Date or date string to "YYYY-MM-DDTHH:mm" (or with seconds) in CLIENT local time
 * for binding to HTML `<input type="datetime-local">`.
 */
export function toDatetimeLocalString(
  dateInput?: string | Date | null,
  includeSeconds = false
): string {
  const d = dateInput ? parseClientDate(dateInput) : new Date();
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return includeSeconds
    ? `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
    : `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a client local datetime (from input or Date) to UTC ISO string
 * for storage in PostgreSQL / Supabase.
 */
export function toUtcIsoTimestamp(dateInput?: string | Date | null): string {
  if (!dateInput) return new Date().toISOString();
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date().toISOString() : dateInput.toISOString();
  }
  const s = String(dateInput).trim();
  if (!s) return new Date().toISOString();

  // If it's a datetime-local value like "2026-09-22T14:59"
  // new Date("2026-09-22T14:59") creates a local Date object.
  // .toISOString() converts it to UTC!
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Alias for parseClientDate for backwards compatibility.
 */
export const parseDbDate = parseClientDate;
