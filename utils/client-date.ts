import { format as dateFnsFormat } from "date-fns";

/**
 * Parses a date or timestamp string from Supabase / PostgreSQL / Oracle / user input
 * into a valid JavaScript Date object in the client's local timezone.
 *
 * Rules:
 * 1. If dateString already contains explicit timezone info (ends with 'Z' or '+HH:mm' / '-HH:mm'),
 *    standard Date constructor parses it into local client time.
 * 2. If dateString is a date-only string ('YYYY-MM-DD'), it is parsed as local midnight.
 * 3. If dateString is a timestamp without timezone ('YYYY-MM-DD HH:mm:ss' or 'YYYY-MM-DDTHH:mm:ss'),
 *    it is parsed directly as LOCAL client time, NEVER forced to UTC.
 */
export function parseClientDate(dateInput?: string | Date | null): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }

  const s = String(dateInput).trim();
  if (!s) return new Date();

  // If explicit timezone offset or Z
  if (s.endsWith("Z") || s.endsWith("z") || /[+-]\d{2}(:\d{2})?$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  // If date-only 'YYYY-MM-DD'
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // If date-time without timezone (e.g. '2026-07-28 14:28:34' or '2026-07-28T14:28:34')
  const isoLike = s.replace(" ", "T");
  const parsed = new Date(isoLike);
  if (!isNaN(parsed.getTime())) {
    return parsed;
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
 * Converts a Date or date string to local DB timestamp format "YYYY-MM-DDTHH:mm:ss"
 * ensuring no timezone skew when written to PostgreSQL TIMESTAMP columns.
 */
export function toLocalDbTimestamp(dateInput?: string | Date | null): string {
  return toDatetimeLocalString(dateInput, true);
}
