// Authored icon set: 20px grid, 1.5 stroke, round joins.
const base = {
  width: 20, height: 20, viewBox: "0 0 20 20", fill: "none",
  stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true,
};

export const ArrowRight = (p) => (
  <svg {...base} {...p}><path d="M4 10h12M11.5 5.5 16 10l-4.5 4.5" /></svg>
);
export const ArrowLeft = (p) => (
  <svg {...base} {...p}><path d="M16 10H4M8.5 5.5 4 10l4.5 4.5" /></svg>
);
export const Chevron = (p) => (
  <svg {...base} {...p}><path d="m6 8 4 4 4-4" /></svg>
);
export const Replay = (p) => (
  <svg {...base} {...p}><path d="M4.5 10a5.5 5.5 0 1 0 1.6-3.9" /><path d="M4.5 3.5v3h3" /></svg>
);
