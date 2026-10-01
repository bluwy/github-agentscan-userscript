import { analyze } from '@unveil/vk'
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
  /** Contributed to bounty repositories (field added since 2026-10-01) */
  isBountyHunter: boolean
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
    return new Response('Known bot or automation', {
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

  let identifyResult: IdentifyResult
  try {
    const result = await analyze(username, { token: env.GITHUB_TOKEN })

    if (result.analysis.isGitHubApp) {
      return new Response('Known bot or automation', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=86400', // Cache for 1 day
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    identifyResult = {
      score: result.analysis.score,
      classification: result.analysis.classification,
      confidence: result.analysis.confidence,
      isCommunityFlagged: await isCommunityFlagged(username, env.GITHUB_TOKEN),
      isBountyHunter: result.analysis.isBountyHunter,
    }
  } catch (e) {
    console.log(`Error analyzing user ${username}:`, e)

    return new Response('User not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
    })
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

async function isCommunityFlagged(username: string, githubToken: string) {
  const response = await fetch(
    'https://api.github.com/repos/MatteoGabriele/agentscan/contents/data/verified-automations-list.json',
    {
      headers: {
        ...userAgentHeader,
        Accept: 'application/vnd.github.raw+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2026-03-10',
      },
      cf: {
        // Cache this the same as the lowest ttl from `getCacheTtl`
        cacheTtl: 60 * 60 * 24 * 2, // 2 days
        cacheEverything: true,
      },
    },
  )
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
      return 60 * 60 * 24 * 3 // 3 days
    default:
      return 60 * 60 * 24 * 2 // 2 days
  }
}
