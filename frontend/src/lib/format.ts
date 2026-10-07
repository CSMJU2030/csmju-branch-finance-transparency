/** Every time on screen is Bangkok time, whatever the server's clock says. */
const TIME_ZONE = "Asia/Bangkok";

/**
 * A calendar date (transaction_date is a DATE): the API sends "2026-10-05T00:00:00.000Z".
 * It is a date without a time, so it is read in UTC - formatting it in Bangkok time
 * would be harmless today but shift it a day in any zone behind UTC.
 */
export function formatCalendarDate(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** A moment (created_at, approved_at ...), shown in Bangkok time. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Today's date as YYYY-MM-DD in Bangkok, the default of the date field. */
export function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}
