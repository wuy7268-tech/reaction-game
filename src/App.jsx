import { useState } from 'react'
import './App.css'
import ProgressPanel from './ProgressPanel'
import ReactionGame from './ReactionGame'
import { ServerStatusProvider, useServerStatus } from './ServerStatus'
import StroopGame from './StroopGame'

function AppShell() {
  const [game, setGame] = useState('reaction')
  const [latestScore, setLatestScore] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)
  const { serverDown } = useServerStatus()

  function handleScoreSaved(score) {
    setLatestScore(score)
  }

  function handleCleared() {
    setLatestScore(null)
    setHistoryKey((key) => key + 1)
  }

  return (
    <div className="app">
      <nav className="game-switcher" aria-label="Choose game">
        <button
          type="button"
          className={game === 'reaction' ? 'is-active' : ''}
          onClick={() => setGame('reaction')}
        >
          Reaction
        </button>
        <button
          type="button"
          className={game === 'stroop' ? 'is-active' : ''}
          onClick={() => setGame('stroop')}
        >
          Stroop
        </button>
      </nav>

      {serverDown && (
        <p className="server-banner" role="alert">
          couldn&apos;t reach the server
        </p>
      )}

      {game === 'reaction' ? (
        <ReactionGame
          historyKey={historyKey}
          onScoreSaved={handleScoreSaved}
        />
      ) : (
        <StroopGame historyKey={historyKey} onScoreSaved={handleScoreSaved} />
      )}

      <ProgressPanel latestScore={latestScore} onCleared={handleCleared} />
    </div>
  )
}

export default function App() {
  return (
    <ServerStatusProvider>
      <AppShell />
    </ServerStatusProvider>
  )
}
