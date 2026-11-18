import styles from "./BankGauge.module.css";

export type BankSegment = { round: number; cost: number; startPct: number; widthPct: number };
export type BankLayout = { left: number; busted: boolean; fillPct: number; segments: BankSegment[] };

// Sums of decimal costs drift (10 - 2.4 - 1.5 = 6.1000000000000005); readings round this far.
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Where each part of the bar goes, as percentages of `total`. The rounds' costs stack from the
 * right end, the first round's outermost, so the latest sits against what is left. A bust (costs
 * above the total) leaves an empty fill and clips the latest cost; no width is ever negative.
 */
export function bankLayout(total: number, spent: readonly number[]): BankLayout {
  const used = spent.reduce((sum, cost) => sum + cost, 0);
  const left = round3(Math.max(0, total - used));
  let rightEdge = 100;
  const segments = spent.map((cost, index) => {
    const widthPct = Math.min(Math.max(0, (cost / total) * 100), rightEdge);
    rightEdge -= widthPct;
    return { round: index + 1, cost, startPct: rightEdge, widthPct };
  });
  return { left, busted: used > total, fillPct: round3((left / total) * 100), segments };
}

/**
 * A bank as a horizontal bar (T179): the fill is what is left, and every round's cost is its own
 * tangerine segment, the latest one draining out of the fill with a "-2.4 s" caption.
 */
export function BankGauge({ total, spent, format, label }: { total: number; spent: readonly number[]; format: (value: number) => string; label: string }) {
  const { left, busted, fillPct, segments } = bankLayout(total, spent);
  const latest = segments.at(-1);
  const status = busted ? "Bank used up" : `${format(left)} left of ${format(total)}`;
  return (
    <div className={styles.gauge}>
      <p className={styles.label}>{label}</p>
      <div
        className={styles.bar}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={left}
        aria-valuetext={status}
      >
        <span className={styles.fill} style={{ width: `${fillPct}%` }} data-bank-fill="" />
        {segments.map((segment) => (
          <span
            // Keyed by round, so only a newly added round plays the drain.
            key={segment.round}
            className={styles.cost}
            data-latest={segment === latest ? "" : undefined}
            style={{ left: `${segment.startPct}%`, width: `${segment.widthPct}%` }}
            data-bank-cost={segment.round}
          />
        ))}
      </div>
      <div className={styles.lines}>
        <p className={styles.status}>{status}</p>
        {latest && <p className={styles.latest}>-{format(latest.cost)}</p>}
      </div>
      <p className={styles.announce} aria-live="polite">
        {latest ? `Round ${latest.round} cost ${format(latest.cost)}${busted ? ". Bank used up" : ""}` : ""}
      </p>
    </div>
  );
}
