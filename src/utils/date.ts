// Returns the UTC calendar day as YYYY-MM-DD, or null when the value is not a parseable date.
export function formatUtcDate(iso: string): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}
