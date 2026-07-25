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

  const bestMs =
    scores.length > 0 ? Math.min(...scores.map((s) => s.ms)) : null

  let message = 'Click to start'
  if (status === 'waiting') message = 'Wait for green...'
  if (status === 'ready') message = 'Click!'
  if (status === 'tooSoon') message = 'Too soon! Click to try again'
  if (status === 'result') message = `${reactionMs} ms — Click to try again`

  return (
    <button
      type="button"
      className={`game game--${status}`}
      onClick={handleClick}
    >
      <h1>Reaction Game</h1>
      <p>{message}</p>

      {bestMs !== null && <p className="best">Best: {bestMs} ms</p>}

      {scores.length > 0 && (
        <ul className="history" aria-label="Saved scores">
          {scores.map((score) => (
            <li key={score.id}>{score.ms} ms</li>
          ))}
        </ul>
      )}
    </button>
  )
}

export default App
