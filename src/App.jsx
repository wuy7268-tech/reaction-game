import { useState } from 'react'
import './App.css'
import ReactionGame from './ReactionGame'
import StroopGame from './StroopGame'

export default function App() {
  const [game, setGame] = useState('reaction')

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

      {game === 'reaction' ? <ReactionGame /> : <StroopGame />}
    </div>
  )
}
