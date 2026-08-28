import { knownBots } from '../constants.ts'
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

  // Known bots should already have a "bot" label, and there's no point in analyzing
  // them further, so mark them as 400. The userscript shouldn't be fetching these in
  // the first place.
  if (knownBots.has(username.toLowerCase())) {
    return new Response('Known bot', {
      status: 400,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  const cached = await env.GITHUB_AGENTSCAN_IDENTIFY.get(username)
  if (cached) {
    const cacheTtl = getCacheTtl(JSON.parse(cached))
    return new Response(cached, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${cacheTtl}`,
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
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  const identifyResult: IdentifyResult = {
    score: data.analysis.score,
    classification: data.analysis.classification,
    confidence: data.analysis.confidence,
    isCommunityFlagged: await isCommunityFlagged(username),
  }
  const cacheTtl = getCacheTtl(identifyResult)
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
      // Cache this the same as the lowest ttl from `getCacheTtl`
      cacheTtl: 60 * 60 * 24, // 1 day
      cacheEverything: true,
    },
  })
  const data: { username: string }[] = await response.json()
  return data.some((item) => item.username === username)
}

function getCacheTtl(identifyResult: IdentifyResult) {
  if (identifyResult.isCommunityFlagged) {
    return 60 * 60 * 24 * 14 // 2 weeks
  }
  switch (identifyResult.classification) {
    case 'automation':
      return 60 * 60 * 24 * 7 // 1 week
    case 'mixed':
      return 60 * 60 * 24 * 4 // 4 days
    default:
      return 60 * 60 * 24 * 2 // 2 days
  }
}
