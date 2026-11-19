/**
 * Helpers for capturing the user's browser-local date, wall-clock timestamp with
 * timezone offset, and IANA timezone so dates/timestamps always reflect the
 * user's local clock rather than the database/server UTC location.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local YYYY-MM-DD in the user's browser timezone (avoids UTC shift from toISOString). */
export function getClientLocalDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local ISO-8601 timestamp with numeric timezone offset, e.g. 2026-11-19T13:26:45+08:00 */
export function getClientLocalTimestamp(date: Date = new Date()): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const offH = pad2(Math.floor(absMin / 60));
  const offM = pad2(absMin % 60);

  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` +
    `${sign}${offH}:${offM}`
  );
}

/** Readable local timestamp string, e.g. 2026-11-19 13:26:45 (+08:00) */
export function getClientLocalDisplayTimestamp(date: Date = new Date()): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const offH = pad2(Math.floor(absMin / 60));
  const offM = pad2(absMin % 60);

  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())} ` +
    `(${sign}${offH}:${offM})`
  );
}

/** IANA timezone name from the user's browser, e.g. Asia/Kuala_Lumpur */
export function getClientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/** Convenience bundle sent with API mutations. */
export function getClientTimePayload(date: Date = new Date()) {
  return {
    clientLocalDate: getClientLocalDate(date),
    clientTimestamp: getClientLocalTimestamp(date),
    clientLocalTime: getClientLocalDisplayTimestamp(date),
    clientTimezone: getClientTimeZone(),
  };
}
