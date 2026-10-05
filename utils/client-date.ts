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
  includeSeconds = true
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
 * Converts a dateInput to a local date string (YYYY-MM-DD) in the user's browser timezone.
 */
export function toLocalDateString(dateInput?: string | Date | null): string {
  const d = dateInput ? parseClientDate(dateInput) : new Date();
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converts a dateInput to a local time string (HH:mm:ss or HH:mm) in the user's browser timezone.
 */
export function toLocalTimeString(
  dateInput?: string | Date | null,
  includeSeconds = true
): string {
  const d = dateInput ? parseClientDate(dateInput) : new Date();
  if (isNaN(d.getTime())) return "";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return includeSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
}

/**
 * Parses any flexible time string (12-hour with AM/PM like "2:30 PM", "2:30pm", "230p", 
 * or 24-hour military like "14:30", "1430", "14:30:45", "930") into a standardized 24-hour time "HH:mm:ss".
 * Returns empty string if invalid.
 */
export function parseFlexibleTimeTo24Hour(input?: string | null): string {
  if (!input || typeof input !== "string") return "";
  let s = input.trim().toUpperCase();
  if (!s) return "";

  // Check for AM / PM indicator
  let isPM = false;
  let isAM = false;
  if (s.endsWith("PM") || s.endsWith("P.M.") || s.endsWith("P")) {
    isPM = true;
    s = s.replace(/P\.?M?\.?$/i, "").trim();
  } else if (s.endsWith("AM") || s.endsWith("A.M.") || s.endsWith("A")) {
    isAM = true;
    s = s.replace(/A\.?M?\.?$/i, "").trim();
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (s.includes(":")) {
    const parts = s.split(":").map(p => parseInt(p, 10));
    hours = isNaN(parts[0]) ? 0 : parts[0];
    minutes = isNaN(parts[1]) ? 0 : parts[1];
    seconds = isNaN(parts[2]) ? 0 : parts[2];
  } else if (/^\d{3,6}$/.test(s)) {
    // Digits only: e.g. "930" (9:30), "1430" (14:30), "143025" (14:30:25), "0930"
    if (s.length === 3) {
      hours = parseInt(s.slice(0, 1), 10);
      minutes = parseInt(s.slice(1, 3), 10);
    } else if (s.length === 4) {
      hours = parseInt(s.slice(0, 2), 10);
      minutes = parseInt(s.slice(2, 4), 10);
    } else if (s.length === 5) {
      hours = parseInt(s.slice(0, 1), 10);
      minutes = parseInt(s.slice(1, 3), 10);
      seconds = parseInt(s.slice(3, 5), 10);
    } else if (s.length === 6) {
      hours = parseInt(s.slice(0, 2), 10);
      minutes = parseInt(s.slice(2, 4), 10);
      seconds = parseInt(s.slice(4, 6), 10);
    }
  } else if (/^\d{1,2}$/.test(s)) {
    // Single or two digits: "9" -> 09:00, "14" -> 14:00
    hours = parseInt(s, 10);
    minutes = 0;
    seconds = 0;
  } else {
    return "";
  }

  // Adjust for 12-hour AM/PM
  if (isPM) {
    if (hours < 12) hours += 12;
  } else if (isAM) {
    if (hours === 12) hours = 0;
  }

  // Bound check
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return "";
  }

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

/**
 * Converts a 24-hour time or flexible string to 12-hour display format (e.g. "02:30:00 PM" or "02:30 PM").
 */
export function to12HourTime(timeInput?: string | null, includeSeconds = true): string {
  const time24 = parseFlexibleTimeTo24Hour(timeInput);
  if (!time24) return timeInput || "";
  const [hh, mm, ss] = time24.split(":").map(Number);
  const period = hh >= 12 ? "PM" : "AM";
  const displayHours = hh % 12 || 12;
  const hhStr = String(displayHours).padStart(2, "0");
  const mmStr = String(mm).padStart(2, "0");
  const ssStr = String(ss).padStart(2, "0");
  return includeSeconds ? `${hhStr}:${mmStr}:${ssStr} ${period}` : `${hhStr}:${mmStr} ${period}`;
}

/**
 * Formats time input to 24-hour string (e.g. "14:30:00" or "14:30").
 */
export function to24HourTime(timeInput?: string | null, includeSeconds = true): string {
  const time24 = parseFlexibleTimeTo24Hour(timeInput);
  if (!time24) return timeInput || "";
  if (!includeSeconds && time24.length >= 5) {
    return time24.substring(0, 5);
  }
  return time24;
}

/**
 * Combines separate local date (YYYY-MM-DD or ISO timestamp) and local time (which can be 12h or 24h) strings
 * into a UTC ISO string for PostgreSQL storage, respecting the user's local timezone.
 */
export function combineLocalDateAndTimeToUtcIso(
  localDate: string,
  localTime: string
): string {
  if (!localDate) return new Date().toISOString();
  
  let dateOnly = String(localDate).trim();
  if (dateOnly.includes("T")) {
    dateOnly = dateOnly.split("T")[0];
  } else if (dateOnly.includes(" ")) {
    dateOnly = dateOnly.split(" ")[0];
  }

  const parsed24 = parseFlexibleTimeTo24Hour(localTime) || "00:00:00";
  const parts = dateOnly.split("-").map(Number);
  
  if (parts.length >= 3 && !parts.some(isNaN)) {
    const [y, m, d] = parts;
    const [hh, mm, ss] = parsed24.split(":").map(Number);
    const localDateObj = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0, 0);
    if (!isNaN(localDateObj.getTime())) {
      return localDateObj.toISOString();
    }
  }

  // Fallback for non-standard formats
  const fallbackDate = new Date(localDate);
  if (!isNaN(fallbackDate.getTime())) {
    const [hh, mm, ss] = parsed24.split(":").map(Number);
    fallbackDate.setHours(hh || 0, mm || 0, ss || 0, 0);
    return fallbackDate.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Alias for parseClientDate for backwards compatibility.
 */
export const parseDbDate = parseClientDate;


