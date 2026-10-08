import { useState } from "react";
import { benchOrder, byslug } from "../data.js";
import SeatMark from "./SeatMark.jsx";

const GAP_SLOTS = 1.6;

// The bench itself: the same shallow curve the seats sit on, drawn behind their centers.
const railPath = Array.from({ length: 41 }, (_, i) => {
  const t = i / 20 - 1;
  return `${i ? "L" : "M"} ${(50 + t * 47).toFixed(2)} ${(t * t).toFixed(4)}`;
}).join(" ");

// Horizontal position (%) and drop below the arc's crown (in seat units) for each justice.
function layout(votes, arrangement, recused) {
  const n = benchOrder.length;
  if (arrangement === "bench") {
    return Object.fromEntries(
      benchOrder.map((j, i) => {
        const t = (i - (n - 1) / 2) / ((n - 1) / 2); // -1 … 1, Chief at 0
        return [j.slug, { x: 6 + (88 * i) / (n - 1), y: t * t }];
      })
    );
  }
  // By vote: majority, then dissent, then anyone recused, each group in bench order.
  const groups = splitGroups(votes, recused).filter((g) => g.members.length);
  const step = 88 / (n - 1 + GAP_SLOTS * (groups.length - 1));
  const pos = {};
  let slot = 0;
  groups.forEach((g, gi) => {
    if (gi) slot += GAP_SLOTS;
    g.members.forEach((j) => (pos[j.slug] = { x: 6 + slot++ * step, y: 0.55 }));
  });
  return pos;
}

function splitGroups(votes, recused) {
  const sitting = benchOrder.filter((j) => !recused.has(j.slug));
  return [
    { key: "majority", label: "Majority", members: sitting.filter((j) => votes[j.slug].vote === "majority") },
    { key: "minority", label: "Dissent", members: sitting.filter((j) => votes[j.slug].vote !== "majority") },
    { key: "recused", label: "Recused", members: benchOrder.filter((j) => recused.has(j.slug)) },
  ];
}

function groupLabels(votes, pos, recused) {
  return splitGroups(votes, recused)
    .filter((g) => g.members.length)
    .map((g) => {
      const xs = g.members.map((j) => pos[j.slug].x);
      return { ...g, count: g.members.length, x: (Math.min(...xs) + Math.max(...xs)) / 2 };
    });
}

const NO_ONE = new Set();

export default function Bench({ votes, author, arrangement = "bench", arrived = null, selected, onSelect, interactive = true, describe, label = "Predicted votes, in bench seating order", recused = NO_ONE, caption, neutral = false }) {
  const pos = layout(votes, arrangement, recused);
  const isPending = (slug) => arrived !== null && !arrived.has(slug);

  return (
    <div className={`bench is-${arrangement}`}>
      {arrangement === "split" && arrived === null && (
        <div className="bench-groups">
          {groupLabels(votes, pos, recused).map((g) => (
            <span key={g.key} className="bench-group" style={{ "--x": `${g.x}%` }}>
              {g.label} <b>{g.count}</b>
            </span>
          ))}
        </div>
      )}
      <svg className="bench-rail" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true">
        <path d={railPath} />
      </svg>
      <ol className="bench-seats" aria-label={label}>
        {benchOrder.map((j) => {
          const v = votes[j.slug];
          const out = recused.has(j.slug);
          const pending = !out && isPending(j.slug);
          const isAuthor = j.slug === author;
          const { x, y } = pos[j.slug];
          const seatLabel = describe ? describe(j, v, pending, out) : out
            ? `${j.name}: recused`
            : pending
            ? `${j.name}: still deliberating`
            : `${j.name}: ${v.role}, ${Math.round(v.confidence * 100)}% confidence${isAuthor ? ", predicted opinion author" : ""}`;
          const inner = (
            <>
              <SeatMark key={out ? "out" : pending ? "pending" : "voted"} vote={v} isAuthor={isAuthor} pending={pending} recused={out} neutral={neutral} />
              <span className="seat-name"><span className="full">{j.last}</span><span className="short" aria-hidden="true">{j.last.slice(0, 3)}</span></span>
              <span className="seat-conf">{caption ? caption(j, v, out) : out ? "Recused" : pending ? "…" : `${Math.round(v.confidence * 100)}%`}</span>
            </>
          );
          return (
            <li
              key={j.slug}
              className={`seat${selected === j.slug ? " is-selected" : ""}${pending ? " is-pending" : ""}${out ? " is-recused" : ""}`}
              style={{ "--x": `${x}%`, "--y": y }}
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

export function BenchLegend({ collapsible = false }) {
  const sample = { vote: "majority", role: "Joins majority", confidence: 0.75 };
  // Open by default on wide screens; on phones the key folds away so the bench and tally lead.
  const [wide] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 701px)").matches);
  const list = (
    <ul className="bench-legend">
      <li>
        <SeatMark vote={sample} size={22} showConfidence={false} /> Majority
        <SeatMark vote={{ ...sample, vote: "minority" }} size={22} showConfidence={false} /> Dissent
      </li>
      <li>
        <SeatMark vote={{ ...sample, role: "Concurrence" }} size={22} showConfidence={false} />
        <SeatMark vote={{ ...sample, vote: "minority", role: "Dissent" }} size={22} showConfidence={false} />
        Center mark: writes an opinion
      </li>
      <li><SeatMark vote={{ ...sample, role: "Writes for the Court" }} isAuthor size={22} showConfidence={false} /> Writes for the Court</li>
      <li><SeatMark vote={sample} size={22} /> Arc and %: confidence in that justice's vote</li>
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
export function TallyMarks({ tally: [maj, min] }) {
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

export const describeSelected = (slug, votes, author) => {
  const j = byslug[slug];
  const v = votes[slug];
  return `${j.name} · ${v.role} · ${Math.round(v.confidence * 100)}% confidence in this vote`;
};
