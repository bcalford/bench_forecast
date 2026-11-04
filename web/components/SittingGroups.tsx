// A term's cases folded by Court sitting: one disclosure per sitting, its name, span and count in the summary.
// No hooks, so the home page (server) and the scorecard (client) both use it.
import type { ReactNode } from "react";
import type { SittingGroup } from "@/lib/sittings";

export default function SittingGroups<T>({ groups, isOpen, children }: {
  groups: SittingGroup<T>[];
  isOpen: (index: number) => boolean;
  children: (rows: T[]) => ReactNode;
}) {
  return groups.map((g, i) => (
    <details key={g.key} className="sitting" open={isOpen(i)}>
      <summary className="sitting-summary">
        <span className="sitting-name">{g.label}</span>
        {g.span && <span className="sitting-span num">{g.span}</span>}
        <span className="sitting-count num">{g.rows.length} {g.rows.length === 1 ? "case" : "cases"}</span>
      </summary>
      {children(g.rows)}
    </details>
  ));
}
