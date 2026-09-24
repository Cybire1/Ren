import type { Summary } from '@/lib/api'
import { usd } from '@/lib/format'

/** The last fourteen days as bars, today in coral. Each bar says its day and total on hover or focus. */
export function DailyChart({ days }: { days: Summary['daily'] }) {
  const values = days.map((d) => Number(d.total))
  const max = Math.max(...values, 0)
  const total = values.reduce((a, b) => a + b, 0)
  const count = days.reduce((a, d) => a + d.count, 0)
  const best = max > 0 ? days[values.indexOf(max)] : null
  const label = (date: string, style: 'short' | 'long') =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString([], style === 'short' ? { weekday: 'narrow' } : { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <section className="card chart" aria-label="Last 14 days">
      <div className="card-head">
        <div>
          <h2>Last 14 days</h2>
          <p>
            {usd(total)} from {count} {count === 1 ? 'payment' : 'payments'}
            {best ? `, best on ${label(best.date, 'long')}` : ''}
          </p>
        </div>
      </div>
      <div className="bars" role="list">
        {days.map((d, i) => {
          const value = Number(d.total)
          const height = max > 0 ? Math.max((value / max) * 100, value > 0 ? 6 : 0) : 0
          const today = i === days.length - 1
          return (
            <div key={d.date} className="bar" role="listitem" tabIndex={0} data-today={today ? 'true' : undefined} aria-label={`${label(d.date, 'long')}: ${usd(value)}, ${d.count} payments`}>
              <span className="bar-tip">
                <strong>{usd(value)}</strong>
                {label(d.date, 'long')}
              </span>
              <span className="bar-track">
                <span className="bar-fill" style={{ height: `${height}%`, animationDelay: `${i * 35}ms` }} />
              </span>
              <span className="bar-day">{today ? 'Today' : label(d.date, 'short')}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
