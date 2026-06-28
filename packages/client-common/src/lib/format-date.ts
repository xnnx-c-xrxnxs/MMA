/**
 * Date/time formatting utilities.
 *
 * **Contract:** the backend always stores and returns timestamps as ISO 8601
 * UTC strings (e.g. "2026-05-13T14:30:00.000Z"). These helpers convert them
 * to a display timezone — never ask the backend for a pre-formatted string.
 *
 * **Default timezone: `Europe/London`** — covers GMT (UTC+0) in winter and
 * BST (UTC+1) in summer automatically via the IANA tz database.
 *
 * **Hermes / React Native:** `Intl.DateTimeFormat` is fully supported in
 * Hermes (the default JS engine in Expo SDK 47+). No polyfill required.
 *
 * Usage:
 *   formatDate(order.createdAt)              // "13 May 2026"
 *   formatDateTime(order.createdAt)          // "13 May 2026, 14:30"
 *   formatDate(ts, { dateStyle: 'short' })   // "13/05/2026"
 *
 *   // Use the device/browser's own timezone instead of the default:
 *   formatDateTime(ts, Intl.DateTimeFormat().resolvedOptions().timeZone)
 *
 * I18n migration: replace the `locale` constant below with your i18n hook's
 * active locale. The timezone arg stays the same.
 */

const DEFAULT_LOCALE = 'en-GB';
export const DEFAULT_TIMEZONE = 'Europe/London';

/**
 * Format a UTC timestamp as a date string in the given timezone.
 *
 * @param utcValue  ISO 8601 UTC string or Date object from the API
 * @param options   `Intl.DateTimeFormatOptions` — defaults to `{ dateStyle: 'medium' }`
 * @param timeZone  IANA timezone string — defaults to `Europe/London`
 */
export function formatDate(
  utcValue: string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { ...options, timeZone }).format(
    new Date(utcValue),
  );
}

/**
 * Format a UTC timestamp as a date + time string in the given timezone.
 *
 * @param utcValue  ISO 8601 UTC string or Date object from the API
 * @param timeZone  IANA timezone string — defaults to `Europe/London`
 */
export function formatDateTime(
  utcValue: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return formatDate(utcValue, { dateStyle: 'medium', timeStyle: 'short' }, timeZone);
}

/**
 * Format a UTC timestamp as a time-only string (e.g. "14:30").
 *
 * @param utcValue  ISO 8601 UTC string or Date object from the API
 * @param timeZone  IANA timezone string — defaults to `Europe/London`
 */
export function formatTime(
  utcValue: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return formatDate(utcValue, { timeStyle: 'short' }, timeZone);
}
