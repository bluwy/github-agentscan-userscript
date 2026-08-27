import flru from 'flru'
import { fetchJson } from './utils-fetch.ts'

export interface IdentifyResult {
  score: number
  classification: 'organic' | 'mixed' | 'automation' | 'insufficient-data'
  confidence: number
  isCommunityFlagged: boolean
}

const cache = flru<IdentifyResult | null | Promise<IdentifyResult | null>>(30)

export async function getIdentifyResult(username: string): Promise<IdentifyResult | null> {
  const cached = cache.get(username)
  if (cached !== undefined) return cached

  const promise = fetchJson<IdentifyResult>(`${API_URL}/identify/${username}`)
  cache.set(username, promise)
  promise.then((result) => cache.set(username, result))

  return promise
}
