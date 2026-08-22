import flru from 'flru'
import { fetchJson } from './utils-fetch.ts'

export interface IdentifyResult {
  score: number
  classification: 'organic' | 'mixed' | 'automation' | 'insufficient-data'
  confidence: number
  isCommunityFlagged: boolean
}

const cache = flru<IdentifyResult | Promise<IdentifyResult>>(30)

export async function getIdentifyResult(username: string): Promise<IdentifyResult> {
  const cached = cache.get(username)
  if (cached) return cached

  const promise = fetchJson<IdentifyResult>(`${API_URL}/identify/${username}`)
  cache.set(username, promise)
  promise.then((result) => cache.set(username, result))

  return promise
}
