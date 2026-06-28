/**
 * Status formatting utilities.
 *
 * Status enum values use SCREAMING_SNAKE_CASE for backend correctness
 * (e.g. PAST_DUE, VALIDATION_FAILED). The UI must NEVER render these raw.
 *
 * Use `formatStatus(value)` for the default Title Case transformation:
 *   PAST_DUE          → "Past Due"
 *   VALIDATION_FAILED → "Validation Failed"
 *   ACTIVE            → "Active"
 *
 * Use `formatStatus(value, labels)` to override specific values
 * (acronyms, marketing copy):
 *   formatStatus("API_KEY_EXPIRED", { API_KEY_EXPIRED: "API Key Expired" })
 *
 * Per-domain helpers (`formatOrderStatus`, `formatUserStatus`, ...) are
 * defined in `./status-labels/` and pre-bind the override map for that domain.
 *
 * I18n migration: replace the body of `formatStatus` with a call to your
 * translation function (e.g. `t(`status.${value}`)`). Per-domain helpers and
 * call sites stay unchanged.
 */
export function formatStatus(value: string, labels?: Readonly<Record<string, string>>): string {
  if (labels && Object.prototype.hasOwnProperty.call(labels, value)) {
    return labels[value];
  }
  return value
    .toLowerCase()
    .split('_')
    .map((word) => (word.length === 0 ? '' : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
}
