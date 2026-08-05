const API_URL = 'http://localhost:8000'
const SCORE_LIMIT = 10

export async function fetchScores(game) {
  const params = new URLSearchParams({ limit: String(SCORE_LIMIT) })
  if (game) params.set('game', game)
  const res = await fetch(`${API_URL}/scores?${params}`)
  if (!res.ok) throw new Error('Failed to load scores')
  return res.json()
}

export async function saveScore({ ms, game, correct = null }) {
  const body = { ms, game }
  if (correct !== null) body.correct = correct

  const res = await fetch(`${API_URL}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to save score')
  return res.json()
}
