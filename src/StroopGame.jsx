import { useEffect, useRef, useState } from 'react'
import { fetchScores, saveScore } from './api'

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

export default function StroopGame() {
  const [status, setStatus] = useState('idle')
  const [trial, setTrial] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [scores, setScores] = useState([])
  const startTimeRef = useRef(null)

  async function refreshScores() {
    try {
      setScores(await fetchScores('stroop'))
    } catch {
      // Backend may be offline while developing the UI.
    }
  }

  useEffect(() => {
    refreshScores()
  }, [])

  function startTrial() {
    setLastResult(null)
    setTrial(pickTrial())
    setStatus('playing')
    startTimeRef.current = performance.now()
  }

  async function chooseColor(inkName) {
    if (status !== 'playing' || !trial) return

    const ms = Math.round(performance.now() - startTimeRef.current)
    const correct = inkName === trial.ink
    setLastResult({ ms, correct })
    setStatus('result')

    try {
      await saveScore({ ms, game: 'stroop', correct })
      await refreshScores()
    } catch {
      // Keep showing the round result even if save fails.
    }
  }

  const attempts = scores.length
  const correctCount = scores.filter((score) => score.correct).length
  const accuracy =
    attempts > 0 ? Math.round((correctCount / attempts) * 100) : null
  const averageMs =
    attempts > 0
      ? Math.round(
          scores.reduce((sum, score) => sum + score.ms, 0) / attempts,
        )
      : null

  return (
    <div className="stroop">
      <h1>Stroop Test</h1>
      <p className="stroop__hint">Pick the ink colour, not the word.</p>

      {status === 'idle' && (
        <button type="button" className="stroop__start" onClick={startTrial}>
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
          </p>
          <button type="button" className="stroop__start" onClick={startTrial}>
            Next
          </button>
        </>
      )}

      {attempts > 0 && (
        <>
          <p>
            Accuracy: {accuracy}% | Average: {averageMs} ms | Attempts:{' '}
            {attempts}
          </p>
          <p aria-label="Saved Stroop scores">
            Past:{' '}
            {scores
              .map(
                (score) =>
                  `${score.ms} ms (${score.correct ? 'ok' : 'miss'})`,
              )
              .join(', ')}
          </p>
        </>
      )}
    </div>
  )
}
