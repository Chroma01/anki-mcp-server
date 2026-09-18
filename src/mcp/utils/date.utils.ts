/**
 * Calendar-day helpers.
 *
 * "A day" here is a *local* calendar day. Anki's own day is local too, but
 * additionally shifted by the user's "next day starts at" hour (4am by
 * default) - AnkiConnect's getNumCardsReviewedByDay passes that hour as
 * seconds into `date(id/1000 - ?, 'unixepoch', 'localtime')`. We do not apply
 * it, so our boundary is local midnight. We assume the server
 * process shares Anki's timezone, which holds for the default localhost
 * AnkiConnect setup; it does not hold when ANKI_CONNECT_URL points at a
 * machine in another zone.
 *
 * A "day key" is the string `YYYY-MM-DD`. Keys sort and compare
 * lexicographically, so downstream day arithmetic is plain string work.
 */

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * The local calendar day an instant falls on.
 *
 * @param timestampMs - Epoch milliseconds (e.g. an Anki revlog id).
 * @param rolloverHour - Hour at which the day rolls over, mirroring Anki's
 *   "next day starts at" preference. Not readable through AnkiConnect yet, so
 *   callers leave it at 0 (midnight).
 */
export function toLocalDayKey(timestampMs: number, rolloverHour = 0): string {
  const local = new Date(timestampMs - rolloverHour * MS_PER_HOUR);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The instant a local day begins: local midnight plus the rollover offset,
 * the inverse of `toLocalDayKey`.
 */
export function localDayStartMs(dayKey: string, rolloverHour = 0): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  return (
    new Date(year, month - 1, day, 0, 0, 0, 0).getTime() +
    rolloverHour * MS_PER_HOUR
  );
}

/**
 * Shift a day key by whole days. Pure UTC arithmetic on the key itself, so it
 * is independent of the host timezone and of DST.
 */
export function addDaysToDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = Date.UTC(year, month - 1, day) + days * MS_PER_DAY;
  return new Date(shifted).toISOString().slice(0, 10);
}
