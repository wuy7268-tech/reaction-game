import { useCallback, useEffect, useState } from 'react'
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
import { fetchAllScoresForChart, fetchStats } from './api'
import { useServerStatus } from './ServerStatus'

function buildChartData(scores) {
  const byGame = { reaction: [], stroop: [] }
  const chronological = [...scores].sort((a, b) => a.id - b.id)

  for (const score of chronological) {
    if (byGame[score.game]) {
      byGame[score.game].push(score.ms)
    }
  }

  const maxLen = Math.max(byGame.reaction.length, byGame.stroop.length, 0)
  const data = []
  for (let i = 0; i < maxLen; i += 1) {
    data.push({
      attempt: i + 1,
      reaction: byGame.reaction[i] ?? null,
      stroop: byGame.stroop[i] ?? null,
    })
  }
  return data
}

export default function ProgressPanel({ refreshKey }) {
  const { reportSuccess, reportFailure } = useServerStatus()
  const [stats, setStats] = useState([])
  const [chartData, setChartData] = useState([])

  const refresh = useCallback(async () => {
    try {
      const [nextStats, scores] = await Promise.all([
        fetchStats(),
        fetchAllScoresForChart(),
      ])
      setStats(nextStats)
      setChartData(buildChartData(scores))
      reportSuccess()
    } catch (error) {
      reportFailure(error)
    }
  }, [reportFailure, reportSuccess])

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  return (
    <section className="progress-panel">
      <h2>Progress</h2>

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
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.15)" />
              <XAxis dataKey="attempt" stroke="#cbd5e1" />
              <YAxis
                stroke="#cbd5e1"
                label={{
                  value: 'ms',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#cbd5e1',
                }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="reaction"
                name="reaction"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="stroop"
                name="stroop"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
