import type { RouteHandler } from '../types.ts'
import { userAgentHeader } from '../utils.ts'

interface IdentifyResult {
  /** 0 - 100 */
  score: number
  /** from @unveil/identity */
  classification: 'organic' | 'mixed' | 'automation' | 'insufficient-data'
  /** 0 - 1 */
  confidence: number
  /** Manually flagged */
  isCommunityFlagged: boolean
}

export const handler: RouteHandler = async (request, env, ctx) => {
  const url = new URL(request.url)
  // Accept /identify/[username]
  const match = url.pathname.match(/^\/identify\/([a-zA-Z0-9-]+)$/)
  if (!match) return

  const username = match[1]

  const cachedIdentifyResultJson = await env.GITHUB_AGENTSCAN_IDENTIFY.get(username)
  if (cachedIdentifyResultJson) {
    return new Response(cachedIdentifyResultJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=31557600, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  const result = await fetch(`https://agentscan.tools/api/identify-replicant/${username}`, {
    headers: userAgentHeader,
  })
  const data: any = await result.json()

  if (result.status === 404) {
    return new Response('User not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  const flagged = await isCommunityFlagged(username)
  const cacheTtl = getCacheTtlByClassification(data.analysis.classification, flagged)
  const identifyResult: IdentifyResult = {
    score: data.analysis.score,
    classification: data.analysis.classification,
    confidence: data.analysis.confidence,
    isCommunityFlagged: flagged,
  }
  const identifyResultJson = JSON.stringify(identifyResult)

  ctx.waitUntil(
    env.GITHUB_AGENTSCAN_IDENTIFY.put(username, identifyResultJson, {
      expirationTtl: cacheTtl,
    }),
  )

  return new Response(identifyResultJson, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${cacheTtl}`,
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function isCommunityFlagged(username: string) {
  const response = await fetch('https://agentscan.tools/api/verified-automations', {
    cf: {
      // Cache this the same as the lowest ttl from `getCacheTtlByClassification`
      cacheTtl: 60 * 60 * 24, // 1 day
      cacheEverything: true,
    },
  })
  const data: { username: string }[] = await response.json()
  return data.some((item) => item.username === username)
}

function getCacheTtlByClassification(
  classification: IdentifyResult['classification'],
  flagged: boolean,
) {
  if (flagged) {
    return 60 * 60 * 24 * 14 // 2 weeks
  }
  switch (classification) {
    case 'automation':
      return 60 * 60 * 24 * 7 // 1 week
    case 'mixed':
      return 60 * 60 * 24 * 3 // 3 days
    default:
      return 60 * 60 * 24 // 1 day
  }
}
