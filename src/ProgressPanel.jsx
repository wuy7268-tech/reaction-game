import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  clearScores,
  fetchAllScoresForChart,
  fetchInsights,
  fetchStats,
} from './api'
import { useServerStatus } from './ServerStatus'

const EMPTY_STATS = [
  { game: 'reaction', best_ms: null, average_ms: null, attempts: 0 },
  { game: 'stroop', best_ms: null, average_ms: null, attempts: 0 },
]

function scoreTimestamp(score) {
  const raw = score.created_at
  if (!raw) return score.id
  // SQLite datetime('now') is UTC with no zone, e.g. "2026-08-15 14:05:00".
  // Date.parse() treats that as local unless we mark it UTC.
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)
  const ms = Date.parse(hasZone ? normalized : `${normalized}Z`)
  return Number.isNaN(ms) ? score.id : ms
}

function formatTick(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildChartData(scores) {
  const chronological = [...scores].sort((a, b) => {
    const timeDiff = scoreTimestamp(a) - scoreTimestamp(b)
    return timeDiff !== 0 ? timeDiff : a.id - b.id
  })

  return chronological.map((score) => chartPointFromScore(score))
}

function chartPointFromScore(score) {
  return {
    id: score.id,
    time: scoreTimestamp(score),
    reaction: score.game === 'reaction' ? score.ms : null,
    stroop: score.game === 'stroop' ? score.ms : null,
  }
}

function applyScoreToStats(stats, score) {
  const base = stats.length ? stats : EMPTY_STATS
  return base.map((item) => {
    if (item.game !== score.game) return item
    const attempts = item.attempts + 1
    const best_ms =
      item.best_ms == null ? score.ms : Math.min(item.best_ms, score.ms)
    const average_ms =
      item.average_ms == null
        ? score.ms
        : Math.round(
            ((item.average_ms * item.attempts + score.ms) / attempts) * 10,
          ) / 10
    return { ...item, attempts, best_ms, average_ms }
  })
}

export default function ProgressPanel({ latestScore, onCleared }) {
  const { reportSuccess, reportFailure } = useServerStatus()
  const [stats, setStats] = useState(EMPTY_STATS)
  const [chartData, setChartData] = useState([])
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const appliedScoreId = useRef(null)

  const loadProgress = useCallback(
    async ({ includeInsights = true } = {}) => {
      setLoading(true)
      try {
        const requests = [fetchStats(), fetchAllScoresForChart()]
        if (includeInsights) requests.push(fetchInsights())

        const [nextStats, scores, nextInsights] = await Promise.all(requests)
        setStats(nextStats)
        setChartData((prev) => {
          const built = buildChartData(scores)
          const known = new Set(built.map((point) => point.id))
          const pending = prev.filter((point) => point.id && !known.has(point.id))
          if (pending.length === 0) return built
          return [...built, ...pending].sort((a, b) => a.time - b.time || a.id - b.id)
        })
        if (includeInsights) setInsights(nextInsights)
        reportSuccess()
      } catch (error) {
        reportFailure(error)
      } finally {
        setLoading(false)
      }
    },
    [reportFailure, reportSuccess],
  )

  useEffect(() => {
    loadProgress({ includeInsights: true })
  }, [loadProgress])

  useEffect(() => {
    if (!latestScore || latestScore.id === appliedScoreId.current) return
    appliedScoreId.current = latestScore.id
    setStats((prev) => applyScoreToStats(prev, latestScore))
    setChartData((prev) => {
      if (prev.some((point) => point.id === latestScore.id)) return prev
      return [...prev, chartPointFromScore(latestScore)]
    })
  }, [latestScore])

  async function handleReset() {
    const confirmed = window.confirm(
      'Clear all saved attempts for both Reaction and Stroop? This deletes them from the server, not just the chart.',
    )
    if (!confirmed) return

    setResetting(true)
    try {
      await clearScores()
      appliedScoreId.current = null
      setStats(EMPTY_STATS)
      setChartData([])
      setInsights({ n_clusters: 0, groups: [], sessions: [] })
      await loadProgress({ includeInsights: true })
      onCleared?.()
      reportSuccess()
    } catch (error) {
      reportFailure(error)
    } finally {
      setResetting(false)
    }
  }

  return (
    <section className="progress-panel">
      <div className="progress-panel__header">
        <h2>Progress</h2>
        <button
          type="button"
          className="reset-button"
          onClick={handleReset}
          disabled={resetting || loading}
        >
          {resetting ? 'Clearing…' : 'Reset all attempts'}
        </button>
      </div>

      {loading ? (
        <p className="loading-note">Loading progress…</p>
      ) : (
        <>
          <div className="stats-grid">
            {stats.map((item) => (
              <div key={item.game} className="stats-card">
                <h3>{item.game}</h3>
                <p>
                  Best:{' '}
                  {item.best_ms != null ? `${item.best_ms} ms` : '—'}
                </p>
                <p>
                  Average:{' '}
                  {item.average_ms != null ? `${item.average_ms} ms` : '—'}
                </p>
                <p>Attempts: {item.attempts}</p>
              </div>
            ))}
          </div>

          <div className="chart-wrap">
            {chartData.length === 0 ? (
              <p className="chart-empty">Play a few rounds to see your chart.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.15)" />
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    stroke="#cbd5e1"
                    tickFormatter={formatTick}
                    minTickGap={28}
                    tickCount={5}
                    angle={-20}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    stroke="#cbd5e1"
                    label={{
                      value: 'ms',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#cbd5e1',
                    }}
                  />
                  <Tooltip
                    labelFormatter={(value) => formatTick(value)}
                    formatter={(value, name) =>
                      value == null ? ['—', name] : [`${value} ms`, name]
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="reaction"
                    name="reaction"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="stroop"
                    name="stroop"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="insights">
            <h2>Session insights</h2>
            {!insights || insights.groups.length === 0 ? (
              <p className="chart-empty">
                Play more sittings (or run <code>npm run seed</code>) to cluster
                sessions.
              </p>
            ) : (
              <>
                <p className="insights__note">
                  K-means on scaled session stats found {insights.n_clusters}{' '}
                  groups.
                </p>
                <div className="insights-grid">
                  {insights.groups.map((group) => (
                    <article key={group.cluster_id} className="insight-card">
                      <h3>{group.label}</h3>
                      <p>
                        {group.size} sitting{group.size === 1 ? '' : 's'}
                      </p>
                      <p>Avg ~ {group.centroid.average_ms} ms</p>
                      <p>Best ~ {group.centroid.best_ms} ms</p>
                      <p>
                        Consistency ~ {group.centroid.consistency_ms} ms stdev
                      </p>
                      <p>
                        Stroop accuracy ~ {group.centroid.accuracy_percent}%
                      </p>
                      <p className="insight-card__sessions">
                        Sessions: {group.session_ids.join(', ')}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
