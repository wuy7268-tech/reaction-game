import { useEffect, useRef, useState } from 'react'
import './App.css'

const MIN_WAIT_MS = 1500
const MAX_WAIT_MS = 4000

function App() {
  const [status, setStatus] = useState('idle')
  const [reactionMs, setReactionMs] = useState(null)
  const timeoutRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
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
    }
  }

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
    </button>
  )
}

export default App
