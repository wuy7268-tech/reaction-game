import { useState } from 'react'
import './App.css'
import ProgressPanel from './ProgressPanel'
import ReactionGame from './ReactionGame'
import StroopGame from './StroopGame'

export default function App() {
  const [game, setGame] = useState('reaction')
  const [refreshKey, setRefreshKey] = useState(0)

  function handleScoresChanged() {
    setRefreshKey((key) => key + 1)
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

      {game === 'reaction' ? (
        <ReactionGame onScoresChanged={handleScoresChanged} />
      ) : (
        <StroopGame onScoresChanged={handleScoresChanged} />
      )}

      <ProgressPanel refreshKey={refreshKey} />
    </div>
  )
}
