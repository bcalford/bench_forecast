"use client";
import { useState, type CSSProperties } from "react";
import { benchOrder, type Justice, type SeatVote } from "@/lib/court";
import SeatMark from "./SeatMark";

const GAP_SLOTS = 1.6;

// The bench itself: the same shallow curve the seats sit on, drawn behind their centers.
const railPath = Array.from({ length: 41 }, (_, i) => {
  const t = i / 20 - 1;
  return `${i ? "L" : "M"} ${(50 + t * 47).toFixed(2)} ${(t * t).toFixed(4)}`;
}).join(" ");

type Votes = Record<string, SeatVote | undefined>;
// Names for the filled and hollow seats; an evenly divided Court has no majority or dissent (lib/vote-labels.ts).
export type SideLabels = { majority: string; minority: string };
const MAJORITY_DISSENT: SideLabels = { majority: "Majority", minority: "Dissent" };

function splitGroups(votes: Votes, recused: Set<string>, sides: SideLabels = MAJORITY_DISSENT) {
  const sitting = benchOrder.filter((j) => !recused.has(j.slug));
  return [
    { key: "majority", label: sides.majority, members: sitting.filter((j) => votes[j.slug]?.vote === "majority") },
    { key: "minority", label: sides.minority, members: sitting.filter((j) => votes[j.slug]?.vote !== "majority") },
    { key: "recused", label: "Recused", members: benchOrder.filter((j) => recused.has(j.slug)) },
  ];
}

// Horizontal position (%) and drop below the arc's crown (in seat units) for each justice.
function layout(votes: Votes, arrangement: "bench" | "split", recused: Set<string>) {
  const n = benchOrder.length;
  if (arrangement === "bench") {
    return Object.fromEntries(
      benchOrder.map((j, i) => {
        const t = (i - (n - 1) / 2) / ((n - 1) / 2); // -1 … 1, Chief at 0
        return [j.slug, { x: 6 + (88 * i) / (n - 1), y: t * t }];
      }),
    );
  }
  // By vote: majority, then dissent, then anyone recused, each group in bench order.
  const groups = splitGroups(votes, recused).filter((g) => g.members.length);
  const step = 88 / (n - 1 + GAP_SLOTS * (groups.length - 1));
  const pos: Record<string, { x: number; y: number }> = {};
  let slot = 0;
  groups.forEach((g, gi) => {
    if (gi) slot += GAP_SLOTS;
    g.members.forEach((j) => (pos[j.slug] = { x: 6 + slot++ * step, y: 0.55 }));
  });
  return pos;
}

const NO_ONE = new Set<string>();
const NEUTRAL: SeatVote = { vote: "majority", role: "", confidence: 0, writes: false };

export default function Bench({
  votes, author = null, arrangement = "bench", arrived = null, selected = null, onSelect, interactive = true,
  label = "Predicted votes, in bench seating order", recused = NO_ONE, neutral = false, caption, describe, sideLabels = MAJORITY_DISSENT,
}: {
  votes: Votes;
  author?: string | null;
  arrangement?: "bench" | "split";
  arrived?: Set<string> | null; // null = every sitting vote is in
  selected?: string | null;
  onSelect?: (slug: string) => void;
  interactive?: boolean;
  label?: string;
  recused?: Set<string>;
  neutral?: boolean; // seats with no vote in them, e.g. the recusal picker
  caption?: string | ((j: Justice, out: boolean) => string); // a string labels every seat the same
  describe?: (j: Justice, out: boolean) => string;
  sideLabels?: SideLabels;
}) {
  const pos = layout(votes, arrangement, recused);
  const isPending = (slug: string) => !neutral && (!votes[slug] || (arrived !== null && !arrived.has(slug)));
  const groups = splitGroups(votes, recused, sideLabels).filter((g) => g.members.length).map((g) => {
    const xs = g.members.map((j) => pos[j.slug].x);
    return { ...g, x: (Math.min(...xs) + Math.max(...xs)) / 2 };
  });

  return (
    <div className={`bench is-${arrangement}`}>
      {arrangement === "split" && arrived === null && (
        <div className="bench-groups">
          {groups.map((g) => (
            <span key={g.key} className="bench-group" style={{ "--x": `${g.x}%` } as CSSProperties}>
              {g.label} <b>{g.members.length}</b>
            </span>
          ))}
        </div>
      )}
      <svg className="bench-rail" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true">
        <path d={railPath} />
      </svg>
      <ol className="bench-seats" aria-label={label}>
        {benchOrder.map((j: Justice) => {
          const v = votes[j.slug];
          const out = recused.has(j.slug);
          const pending = !out && isPending(j.slug);
          const isAuthor = j.slug === author;
          const { x, y } = pos[j.slug] ?? { x: 50, y: 0 };
          const seatLabel = describe ? describe(j, out) : out
            ? `${j.name}: recused`
            : pending || !v
            ? `${j.name}: still deliberating`
            : `${j.name}: ${v.role}, ${Math.round(v.confidence * 100)}% confidence${isAuthor ? ", predicted opinion author" : ""}`;
          const inner = (
            <>
              <SeatMark key={out ? "out" : pending ? "pending" : "voted"} vote={neutral ? NEUTRAL : v} isAuthor={isAuthor} pending={pending} recused={out} neutral={neutral} />
              <span className="seat-name"><span className="full">{j.last}</span><span className="short" aria-hidden="true">{j.last.slice(0, 3)}</span></span>
              <span className="seat-conf">{typeof caption === "string" ? caption : caption ? caption(j, out) : out ? "Recused" : pending || !v ? "…" : `${Math.round(v.confidence * 100)}%`}</span>
            </>
          );
          return (
            <li
              key={j.slug}
              className={`seat${selected === j.slug ? " is-selected" : ""}${pending ? " is-pending" : ""}${out ? " is-recused" : ""}`}
              style={{ "--x": `${x}%`, "--y": y } as CSSProperties}
            >
              {interactive ? (
                <button type="button" aria-label={seatLabel} aria-pressed={selected === j.slug} onClick={() => onSelect?.(j.slug)}>
                  {inner}
                </button>
              ) : (
                <span className="seat-btn" aria-hidden="true">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function BenchLegend({ collapsible = false, sideLabels = MAJORITY_DISSENT }: { collapsible?: boolean; sideLabels?: SideLabels }) {
  const sample: SeatVote = { vote: "majority", role: "Joins majority", confidence: 0.75, writes: false };
  // Open by default on wide screens; on phones the key folds away so the bench and tally lead.
  const [wide] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 701px)").matches);
  const list = (
    <ul className="bench-legend">
      <li>
        <SeatMark vote={sample} size={22} showConfidence={false} /> {sideLabels.majority}
        <SeatMark vote={{ ...sample, vote: "minority" }} size={22} showConfidence={false} /> {sideLabels.minority}
      </li>
      <li>
        <SeatMark vote={{ ...sample, writes: true }} size={22} showConfidence={false} />
        <SeatMark vote={{ ...sample, vote: "minority", writes: true }} size={22} showConfidence={false} />
        Center mark: writes an opinion
      </li>
      <li><SeatMark vote={{ ...sample, writes: true }} isAuthor size={22} showConfidence={false} /> Writes for the Court</li>
      <li><SeatMark vote={sample} size={22} /> Arc and %: confidence in that justice&apos;s vote</li>
    </ul>
  );
  if (!collapsible) return list;
  return (
    <details className="bench-key" open={wide}>
      <summary>Key to the marks</summary>
      {list}
    </details>
  );
}

// Nine marks, majority first, for list rows where seat identity isn't known.
export function TallyMarks({ tally: [maj, min] }: { tally: [number, number] }) {
  const marks = [...Array(maj).fill("majority"), ...Array(min).fill("minority")];
  return (
    <span className="tally-marks" aria-label={`${maj} to ${min}`}>
      {marks.map((m, i) => (
        <svg key={i} viewBox="0 0 10 10" aria-hidden="true">
          <circle cx="5" cy="5" r={m === "majority" ? 4.2 : 3.6} className={m === "majority" ? "tm-fill" : "tm-ring"} />
        </svg>
      ))}
    </span>
  );
}
