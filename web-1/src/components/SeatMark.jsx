import { writesSeparately } from "../data.js";

const R_ARC = 29;
const HALF = Math.PI * R_ARC;
// The confidence gauge is the seat's back: a half arc over the mark, filling left to right.
const BACK = `M ${32 - R_ARC} 32 A ${R_ARC} ${R_ARC} 0 0 1 ${32 + R_ARC} 32`;

// One justice's seat. Shape carries the vote, never hue:
// filled = majority, open ring = dissent, inner cut/dot = writes separately,
// brass = predicted opinion author. The half arc above is confidence.
// Neutral: a hairline seat with no vote in it, for pages that show a justice, not a vote.
export default function SeatMark({ vote, isAuthor = false, pending = false, recused = false, neutral = false, size = 64, showConfidence = true }) {
  const cls = ["seat-mark", isAuthor && "is-author", pending && "is-pending", recused && "is-recused"].filter(Boolean).join(" ");

  // Recused: the seat stands empty and is struck through; it takes no part in the tally.
  if (recused) {
    return (
      <svg className={cls} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="18.5" className="sm-empty" />
        <path d="M 18 46 L 46 18" className="sm-strike" />
      </svg>
    );
  }

  if (pending || !vote) {
    return (
      <svg className={cls} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="19" className="sm-pending" />
      </svg>
    );
  }

  const majority = vote.vote === "majority";
  const separate = writesSeparately(vote);

  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {showConfidence && (
        <>
          <path d={BACK} className="sm-track" />
          <path d={BACK} className="sm-conf" strokeDasharray={`${vote.confidence * HALF} ${HALF}`} />
        </>
      )}
      {neutral ? (
        <circle cx="32" cy="32" r="18.5" className="sm-seat" />
      ) : majority ? (
        <>
          <circle cx="32" cy="32" r="20" className="sm-fill" />
          {separate && <circle cx="32" cy="32" r="9" className="sm-cut" />}
        </>
      ) : (
        <>
          <circle cx="32" cy="32" r="18.5" className="sm-ring" />
          {separate && <circle cx="32" cy="32" r="6" className="sm-fill" />}
        </>
      )}
    </svg>
  );
}
