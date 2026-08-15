import { useEffect, useRef, useState } from 'react'
import {
  addAttemptToStats,
  emptyGameStats,
  fetchScores,
  fetchStats,
  saveScore,
  statsForGame,
} from './api'
import { useServerStatus } from './ServerStatus'

const COLORS = [
  { name: 'RED', value: '#e74c3c' },
  { name: 'GREEN', value: '#27ae60' },
  { name: 'BLUE', value: '#3498db' },
  { name: 'YELLOW', value: '#f1c40f' },
]

function pickTrial() {
  const word = COLORS[Math.floor(Math.random() * COLORS.length)]
  let ink = COLORS[Math.floor(Math.random() * COLORS.length)]
  if (ink.name === word.name) {
    ink = COLORS[(COLORS.indexOf(ink) + 1) % COLORS.length]
  }
  return { word: word.name, ink: ink.name, inkValue: ink.value }
}

export default function StroopGame({ historyKey = 0, onScoreSaved }) {
  const [status, setStatus] = useState('idle')
  const [trial, setTrial] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [scores, setScores] = useState([])
  const [summary, setSummary] = useState(() => emptyGameStats('stroop'))
  const [loadingScores, setLoadingScores] = useState(true)
  const [saving, setSaving] = useState(false)
  const startTimeRef = useRef(null)
  const { reportSuccess, reportFailure } = useServerStatus()

  useEffect(() => {
    let cancelled = false

    async function loadScores() {
      setLoadingScores(true)
      try {
        const [next, stats] = await Promise.all([
          fetchScores('stroop'),
          fetchStats(),
        ])
        if (!cancelled) {
          setScores(next)
          setSummary(statsForGame(stats, 'stroop'))
          reportSuccess()
        }
      } catch (error) {
        if (!cancelled) reportFailure(error)
      } finally {
        if (!cancelled) setLoadingScores(false)
      }
    }

    loadScores()
    return () => {
      cancelled = true
    }
  }, [historyKey, reportFailure, reportSuccess])

  function startTrial() {
    if (saving) return
    setLastResult(null)
    setTrial(pickTrial())
    setStatus('playing')
    startTimeRef.current = performance.now()
  }

  async function chooseColor(inkName) {
    if (status !== 'playing' || !trial || saving) return

    const ms = Math.round(performance.now() - startTimeRef.current)
    const correct = inkName === trial.ink
    setLastResult({ ms, correct })
    setStatus('result')
    setSaving(true)

    try {
      const saved = await saveScore({ ms, game: 'stroop', correct })
      setScores((prev) => [saved, ...prev].slice(0, 10))
      setSummary((prev) => addAttemptToStats(prev, saved.ms))
      reportSuccess()
      onScoreSaved?.(saved)
    } catch (error) {
      reportFailure(error)
    } finally {
      setSaving(false)
    }
  }

  const { attempts, average_ms: averageMs } = summary
  const recentCorrect = scores.filter((score) => score.correct).length
  const accuracy =
    scores.length > 0
      ? Math.round((recentCorrect / scores.length) * 100)
      : null

  return (
    <div className="stroop">
      <h1>Stroop Test</h1>
      <p className="stroop__hint">Pick the ink colour, not the word.</p>

      {status === 'idle' && (
        <button
          type="button"
          className="stroop__start"
          onClick={startTrial}
          disabled={saving}
        >
          Start
        </button>
      )}

      {status === 'playing' && trial && (
        <>
          <p
            className="stroop__word"
            style={{ color: trial.inkValue }}
            aria-label={`Word ${trial.word} in ${trial.ink} ink`}
          >
            {trial.word}
          </p>
          <div className="stroop__choices">
            {COLORS.map((color) => (
              <button
                key={color.name}
                type="button"
                className="stroop__choice"
                style={{ background: color.value }}
                onClick={() => chooseColor(color.name)}
                disabled={saving}
              >
                {color.name}
              </button>
            ))}
          </div>
        </>
      )}

      {status === 'result' && lastResult && (
        <>
          <p>
            {lastResult.correct ? 'Correct' : 'Wrong'} — {lastResult.ms} ms
            {saving ? ' — Saving…' : ''}
          </p>
          <button
            type="button"
            className="stroop__start"
            onClick={startTrial}
            disabled={saving}
          >
            Next
          </button>
        </>
      )}

      {loadingScores ? (
        <p className="loading-note">Loading scores…</p>
      ) : (
        <>
          <p>
            Accuracy: {accuracy != null ? `${accuracy}%` : '—'} | Average:{' '}
            {averageMs != null ? `${averageMs} ms` : '—'} | Attempts:{' '}
            {attempts}
          </p>
          {scores.length > 0 && (
            <p aria-label="Saved Stroop scores">
              Past:{' '}
              {scores
                .map(
                  (score) =>
                    `${score.ms} ms (${score.correct ? 'ok' : 'miss'})`,
                )
                .join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
