import { useEffect, useRef, useState } from 'react'
import './App.css'

const MIN_WAIT_MS = 1500
const MAX_WAIT_MS = 4000
const API_URL = 'http://localhost:8000'
const SCORE_LIMIT = 10

function App() {
  const [status, setStatus] = useState('idle')
  const [reactionMs, setReactionMs] = useState(null)
  const [scores, setScores] = useState([])
  const timeoutRef = useRef(null)
  const startTimeRef = useRef(null)

  async function refreshScores() {
    try {
      const res = await fetch(`${API_URL}/scores?limit=${SCORE_LIMIT}`)
      if (!res.ok) return
      const data = await res.json()
      setScores(data)
    } catch {
      // Backend may be offline while developing the UI.
    }
  }

  async function saveScore(ms) {
    const res = await fetch(`${API_URL}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ms }),
    })
    if (!res.ok) throw new Error('Failed to save score')
    await refreshScores()
  }

  useEffect(() => {
    refreshScores()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

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
      saveScore(ms).catch(() => {
        // Keep showing the round result even if save fails.
      })
    }
  }

  let message = 'Click to start'
  if (status === 'waiting') message = 'Wait for green...'
  if (status === 'ready') message = 'Click!'
  if (status === 'tooSoon') message = 'Too soon! Click to try again'
  if (status === 'result') message = `${reactionMs} ms — Click to try again`

  const attempts = scores.length
  const bestMs =
    attempts > 0 ? Math.min(...scores.map((score) => score.ms)) : null
  const averageMs =
    attempts > 0
      ? Math.round(
          scores.reduce((sum, score) => sum + score.ms, 0) / attempts,
        )
      : null

  return (
    <button
      type="button"
      className={`game game--${status}`}
      onClick={handleClick}
    >
      <h1>Reaction Game</h1>
      <p>{message}</p>

      {attempts > 0 && (
        <>
          <p>
            Best: {bestMs} ms | Average: {averageMs} ms | Attempts: {attempts}
          </p>
          <p aria-label="Saved scores">
            Past scores: {scores.map((score) => `${score.ms} ms`).join(', ')}
          </p>
        </>
      )}
    </button>
  )
}

export default App
