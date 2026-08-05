const API_URL = 'http://localhost:8000'
const SCORE_LIMIT = 10
const CHART_LIMIT = 50

export class ServerUnreachableError extends Error {
  constructor(message = "couldn't reach the server") {
    super(message)
    this.name = 'ServerUnreachableError'
  }
}

async function request(path, options) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`, options)
  } catch {
    throw new ServerUnreachableError()
  }

  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`)
  }

  return res.json()
}

export async function fetchScores(game, limit = SCORE_LIMIT) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (game) params.set('game', game)
  return request(`/scores?${params}`)
}

export async function fetchAllScoresForChart() {
  return request(`/scores?limit=${CHART_LIMIT}`)
}

export async function fetchStats() {
  return request('/stats')
}

export async function saveScore({ ms, game, correct = null }) {
  const body = { ms, game }
  if (correct !== null) body.correct = correct

  return request('/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
