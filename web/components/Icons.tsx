// Authored icon set: 20px grid, 1.5 stroke, round joins.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base: P = {
  width: 20, height: 20, viewBox: "0 0 20 20", fill: "none",
  stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
};

export const ArrowRight = (p: P) => <svg {...base} {...p}><path d="M4 10h12M11.5 5.5 16 10l-4.5 4.5" /></svg>;
export const ArrowLeft = (p: P) => <svg {...base} {...p}><path d="M16 10H4M8.5 5.5 4 10l4.5 4.5" /></svg>;
export const Chevron = (p: P) => <svg {...base} {...p}><path d="m6 8 4 4 4-4" /></svg>;
// Checked: drawn on its own 16px grid so it sits on a text line.
export const CheckMark = ({ on = true, ...p }: P & { on?: boolean }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" {...p}>
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
    {on && <path d="M4.8 8.2 7 10.4l4.2-4.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
);
export const Lock = (p: P) => <svg {...base} {...p}><path d="M6.75 9V6.5a3.25 3.25 0 0 1 6.5 0V9" /><rect x="4" y="9" width="12" height="8.5" rx="1.5" /></svg>;
export const Replay = (p: P) => <svg {...base} {...p}><path d="M4.5 10a5.5 5.5 0 1 0 1.6-3.9" /><path d="M4.5 3.5v3h3" /></svg>;
