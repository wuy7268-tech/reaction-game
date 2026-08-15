const API_URL = 'http://localhost:8000'
const SCORE_LIMIT = 10
const CHART_LIMIT = 100

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

export function emptyGameStats(game) {
  return { game, best_ms: null, average_ms: null, attempts: 0 }
}

export function statsForGame(stats, game) {
  return stats.find((item) => item.game === game) ?? emptyGameStats(game)
}

export function addAttemptToStats(stats, ms) {
  const attempts = stats.attempts + 1
  const best_ms = stats.best_ms == null ? ms : Math.min(stats.best_ms, ms)
  const average_ms =
    stats.average_ms == null
      ? ms
      : Math.round((stats.average_ms * stats.attempts + ms) / attempts)
  return { ...stats, attempts, best_ms, average_ms }
}

export async function fetchInsights() {
  return request('/insights')
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

export async function clearScores() {
  return request('/scores', { method: 'DELETE' })
}
