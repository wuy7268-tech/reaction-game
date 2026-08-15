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

const MIN_WAIT_MS = 1500
const MAX_WAIT_MS = 4000

export default function ReactionGame({ historyKey = 0, onScoreSaved }) {
  const [status, setStatus] = useState('idle')
  const [reactionMs, setReactionMs] = useState(null)
  const [scores, setScores] = useState([])
  const [summary, setSummary] = useState(() => emptyGameStats('reaction'))
  const [loadingScores, setLoadingScores] = useState(true)
  const [saving, setSaving] = useState(false)
  const timeoutRef = useRef(null)
  const startTimeRef = useRef(null)
  const { reportSuccess, reportFailure } = useServerStatus()

  useEffect(() => {
    let cancelled = false

    async function loadScores() {
      setLoadingScores(true)
      try {
        const [next, stats] = await Promise.all([
          fetchScores('reaction'),
          fetchStats(),
        ])
        if (!cancelled) {
          setScores(next)
          setSummary(statsForGame(stats, 'reaction'))
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
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [historyKey, reportFailure, reportSuccess])

  function clearWait() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  function startGame() {
    clearWait()
    setReactionMs(null)
    setStatus('waiting')

    const delay =
      MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS)

    timeoutRef.current = setTimeout(() => {
      startTimeRef.current = performance.now()
      setStatus('ready')
    }, delay)
  }

  function handleClick() {
    if (saving) return

    if (status === 'idle' || status === 'result' || status === 'tooSoon') {
      startGame()
      return
    }

    if (status === 'waiting') {
      clearWait()
      setStatus('tooSoon')
      return
    }

    if (status === 'ready') {
      const ms = Math.round(performance.now() - startTimeRef.current)
      setReactionMs(ms)
      setStatus('result')
      setSaving(true)
      saveScore({ ms, game: 'reaction' })
        .then((saved) => {
          setScores((prev) => [saved, ...prev].slice(0, 10))
          setSummary((prev) => addAttemptToStats(prev, saved.ms))
          reportSuccess()
          onScoreSaved?.(saved)
        })
        .catch((error) => {
          reportFailure(error)
        })
        .finally(() => {
          setSaving(false)
        })
    }
  }

  let message = 'Click to start'
  if (status === 'waiting') message = 'Wait for green...'
  if (status === 'ready') message = 'Click!'
  if (status === 'tooSoon') message = 'Too soon! Click to try again'
  if (status === 'result') {
    message = saving
      ? `${reactionMs} ms — Saving…`
      : `${reactionMs} ms — Click to try again`
  }

  const { attempts, best_ms: bestMs, average_ms: averageMs } = summary

  return (
    <button
      type="button"
      className={`game game--${status}`}
      onClick={handleClick}
      disabled={saving}
    >
      <h1>Reaction Game</h1>
      <p>{message}</p>

      {loadingScores ? (
        <p className="loading-note">Loading scores…</p>
      ) : (
        <>
          <p>
            Best: {bestMs != null ? `${bestMs} ms` : '—'} | Average:{' '}
            {averageMs != null ? `${averageMs} ms` : '—'} | Attempts:{' '}
            {attempts}
          </p>
          {scores.length > 0 && (
            <p aria-label="Saved scores">
              Past scores:{' '}
              {scores.map((score) => `${score.ms} ms`).join(', ')}
            </p>
          )}
        </>
      )}
    </button>
  )
}
