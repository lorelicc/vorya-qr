import { formatDay, formatNumber } from "@/lib/format";
import styles from "./DailyChart.module.css";

type Day = { date: string; count: number };

/**
 * Daily scans for the last 30 days. Bars are a stretched SVG; labels are HTML so they keep
 * their size at any width. A hidden table gives screen readers the exact values.
 */
export function DailyChart({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const ticks = [max, Math.round(max / 2), 0].filter((v, i, all) => all.indexOf(v) === i);
  const labelled = [0, Math.floor(days.length / 2), days.length - 1];

  return (
    <figure className={styles.chart}>
      <div className={styles.plot}>
        <div className={styles.axis} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{formatNumber(tick)}</span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${days.length * 10} 100`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Scansioni giornaliere degli ultimi 30 giorni"
        >
          {[0, 50, 100].map((y) => (
            <line key={y} x1={0} x2={days.length * 10} y1={y} y2={y} className={styles.grid} />
          ))}
          {days.map((day, index) => {
            const height = (day.count / max) * 100;
            return (
              <rect
                key={day.date}
                x={index * 10 + 1.5}
                y={100 - height}
                width={7}
                height={height}
                className={styles.bar}
              >
                <title>{`${formatDay(day.date)}: ${formatNumber(day.count)} scansioni`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className={styles.labels} aria-hidden="true">
        {labelled.map((index) =>
          days[index] ? <span key={index}>{formatDay(days[index].date)}</span> : null,
        )}
      </div>
      <div className="visually-hidden">
        <table>
          <caption>Scansioni per giorno</caption>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <th scope="row">{formatDay(day.date)}</th>
                <td>{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
