const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dayFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dateTimeFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (value: string) => dateFormat.format(new Date(value));
export const formatDateTime = (value: string) => dateTimeFormat.format(new Date(value));
/** For YYYY-MM-DD days already computed in Europe/Rome by the backend. */
export const formatDay = (isoDay: string) => dayFormat.format(new Date(`${isoDay}T00:00:00Z`));
export const formatNumber = (value: number) => new Intl.NumberFormat("it-IT").format(value);

export function daysLeft(until: string | null, now = Date.now()): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((new Date(until).getTime() - now) / 86_400_000));
}

export function scansLabel(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? "scansione" : "scansioni"}`;
}

export function limitLabel(limit: number | null): string {
  return limit === null ? "illimitati" : formatNumber(limit);
}
