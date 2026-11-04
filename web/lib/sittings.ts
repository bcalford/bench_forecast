// Court sittings: the Court names each one after its hearing list's month, and a sitting can cross into the
// next month (December's opens Nov 30), so a case's sitting comes from the list it's on, not its argument date.
import { normalizeDocket, type HearingCase } from "./court-site";

export type Sitting = { name: string; start: string; end: string }; // "November", first and last argument day
export type SittingGroup<T> = { key: string; label: string; span: string | null; rows: T[] };

export function sittingFromList(name: string, cases: HearingCase[]): Sitting | null {
  const days = cases.map((c) => c.argued).filter(Boolean).sort();
  return days.length ? { name, start: days[0], end: days[days.length - 1] } : null;
}

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const monthDay = (iso: string) => day(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function sittingSpan(s: Sitting): string {
  if (s.start === s.end) return monthDay(s.start);
  if (s.start.slice(0, 7) === s.end.slice(0, 7)) return `${monthDay(s.start)}–${day(s.end).getUTCDate()}`;
  return `${monthDay(s.start)} – ${monthDay(s.end)}`;
}

export const argued = (iso: string) => `Argued ${monthDay(iso)}`;

// Newest sitting first, each in argument order (same day: filing order); cases with no sitting (filed through the form) last, newest filed first.
export function groupBySitting<T extends { sitting: Sitting | null; argued: string | null; filed: string }>(rows: T[]): SittingGroup<T>[] {
  const groups = new Map<string, SittingGroup<T>>();
  for (const r of rows) {
    const key = r.sitting?.start ?? "site";
    if (!groups.has(key)) groups.set(key, r.sitting ? { key, label: `${r.sitting.name} sitting`, span: sittingSpan(r.sitting), rows: [] } : { key, label: "Filed on this site", span: null, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  const sittings = [...groups.values()].filter((g) => g.key !== "site").sort((a, b) => b.key.localeCompare(a.key));
  for (const g of sittings) g.rows.sort((a, b) => (a.argued ?? "").localeCompare(b.argued ?? "") || a.filed.localeCompare(b.filed));
  const site = groups.get("site");
  site?.rows.sort((a, b) => b.filed.localeCompare(a.filed));
  return site ? [...sittings, site] : sittings;
}

// The sitting each filed case is on, for cases filed without one (through the form, or before sittings were kept).
export function sittingUpdates(
  cases: { id: string; docket: string | null; sitting: string | null; argued_on: string | null }[],
  listed: HearingCase[],
) {
  const byDocket = new Map(listed.filter((h) => h.sitting).map((h) => [normalizeDocket(h.docket), h]));
  return cases.flatMap((c) => {
    const h = !c.sitting && c.docket ? byDocket.get(normalizeDocket(c.docket)) : undefined;
    return h ? [{ id: c.id, sitting: h.sitting!.name, sitting_start: h.sitting!.start, sitting_end: h.sitting!.end, argued_on: c.argued_on ?? h.argued }] : [];
  });
}
