
const NAV = [
  { view: "case", label: "Sample forecast", short: "Sample", also: ["reader"] },
  { view: "scorecard", label: "Scorecard" },
  { view: "method", label: "Method" },
  { view: "new", label: "Forecast a case", primary: true, also: ["run"] },
];

// The mark: one seat. A vote (the disk) under a seat back drawn three-quarters round
// (the forecast's confidence), resting on the bench.
export function Logo({ size = 28 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <path className="logo-track" d="M 3 17 A 11 11 0 0 1 25 17" />
      <path className="logo-conf" d="M 3 17 A 11 11 0 0 1 25 17" pathLength="100" strokeDasharray="74 100" />
      <circle className="logo-seat" cx="14" cy="17" r="5.5" />
      <path className="logo-bench" d="M 2.5 25.5 H 25.5" />
    </svg>
  );
}

export function Masthead({ view }) {
  return (
    <header className="masthead">
      <div className="wrap masthead-row">
        <a className="wordmark" href="#/home" aria-label="Bench Forecast, home">
          <Logo />
          Bench Forecast
        </a>
        <nav className="masthead-nav" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.view} href={`#/${n.view}`} className={n.primary ? "nav-primary" : undefined} aria-current={n.view === view || n.also?.includes(view) ? "page" : undefined}>
              {n.short ? <><span className="label-full">{n.label}</span><span className="label-short">{n.short}</span></> : n.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

// The lock seal is one object with two states: open (dashed, shackle raised) while votes
// arrive, then locked (solid brass, shackle down). `justLocked` plays the closing once.
export function LockSeal({ lockedAt, phase, compact = false, open = false, justLocked = false }) {
  const cls = ["lock-seal", compact && "is-compact", open ? "is-open" : "is-locked", justLocked && "just-locked"].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <svg className="lock-seal-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path className="shackle" d="M6.75 9V6.5a3.25 3.25 0 0 1 6.5 0V9" />
        <rect x="4" y="9" width="12" height="8.5" rx="1.5" />
      </svg>
      <div>
        <div className="lock-seal-head">{open ? "Not locked yet" : "Locked"}</div>
        {open ? (
          <div className="lock-seal-phase">Locks when the last vote is in</div>
        ) : (
          <>
            <time className="lock-seal-time">{lockedAt}</time>
            {!compact && <div className="lock-seal-phase">{phase}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-row">
        <p>Prediction for educational purposes, not legal advice.</p>
        <p>Cases shown are fictional sample data. Bench Forecast, 2026.</p>
      </div>
    </footer>
  );
}
