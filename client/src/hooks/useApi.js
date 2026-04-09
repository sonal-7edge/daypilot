import { useState, useEffect } from 'react'

const BASE = import.meta.env.VITE_API_URL || ''

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function useApi(path, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!path) return
    setLoading(true)
    setError(null)
    apiFetch(path)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, deps)

  return { data, loading, error, setData }
}
