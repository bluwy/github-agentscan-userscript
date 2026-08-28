import { getIdentifyResult } from '../identify-result.ts'
import { getUsername } from '../utils-username.ts'

const analyzedEls = new WeakSet<HTMLElement>()

export function report() {
  handlePR()
  // It's too difficult to handle for issues right now, so skipping
}

function handlePR() {
  const reportButtons = document.querySelectorAll<HTMLAnchorElement>(
    [
      // Normal comment
      '.timeline-comment-header a[aria-label="Report abusive content"]',
      // Review comment
      '.timeline-comment-group a[aria-label="Report content"]',
    ].join(', '),
  )
  for (const button of reportButtons) {
    if (analyzedEls.has(button)) continue
    analyzedEls.add(button)

    const header = button.closest('.timeline-comment-header, .timeline-comment-group')
    if (!header) continue

    const authorEl = header.querySelector<HTMLAnchorElement>('a.author')
    if (!authorEl) continue

    const username = getUsername(authorEl)
    if (!username) continue

    const userId = header
      .querySelector('img[src^="https://avatars.githubusercontent.com/u/"]')
      ?.getAttribute('src')
      ?.match(/\/u\/(\d+)\?/)?.[1]
    if (!userId) continue

    // Add the report button
    const reportButton = button.cloneNode() as HTMLAnchorElement
    reportButton.href = buildSimpleReportIssueUrl(username, userId)
    reportButton.target = '_blank'
    reportButton.textContent = 'Report to AgentScan'
    reportButton.setAttribute('aria-label', 'Report to AgentScan')
    delete reportButton.dataset.gaClick
    delete reportButton.dataset.testSelector
    button.insertAdjacentElement('afterend', reportButton)

    // Update the report button href with a more complete link later as it may take a while,
    // and we want to show the report button first
    buildFullReportIssueUrl(username, userId)
      .then((url) => {
        if (!url) return
        // The element could have been removed if the fetch took too long and the user navigated away
        if (!reportButton.isConnected) return
        reportButton.href = url
      })
      .catch((err) => {
        console.error('Error building report issue URL for user', username, err)
      })
  }
}

function buildSimpleReportIssueUrl(username: string, userId: string): string {
  const url = new URL('https://github.com/matteogabriele/agentscan/issues/new')
  url.searchParams.set('template', 'report-automated-account.yml')
  url.searchParams.set('title', `[AUTOMATION] ${username}`)
  url.searchParams.set('username', username)
  url.searchParams.set('user-id', userId)

  url.searchParams.set('evidence', `- Flagged in: ${withoutBacklink(location.href)}`)

  return url.toString()
}

// From agentscan-action
async function buildFullReportIssueUrl(username: string, userId: string): Promise<string | null> {
  const result = await getIdentifyResult(username)
  if (!result) return null

  const url = new URL('https://github.com/matteogabriele/agentscan/issues/new')
  url.searchParams.set('template', 'report-automated-account.yml')
  url.searchParams.set('title', `[AUTOMATION] ${username}`)
  url.searchParams.set('username', username)
  url.searchParams.set('user-id', userId)

  url.searchParams.set(
    'reason',
    `AgentScan classified this account as possible "${result.classification}" (score ${result.score}/100).`,
  )
  url.searchParams.set('evidence', `- Flagged in: ${withoutBacklink(location.href)}`)

  return url.toString()
}

function withoutBacklink(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'github.com') {
      parsed.hostname = 'redirect.github.com'
    }
    return parsed.toString()
  } catch {
    return url
  }
}
