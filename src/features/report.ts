import { getIdentifyResult, type IdentifyResult } from '../identify-result.ts'
import { getUsername } from '../utils-username.ts'
import { waitUntilDisconnected, waitUntilInView } from '../utils-wait.ts'

const analyzedEls = new WeakSet<HTMLElement>()

export function report() {
  const menus = document.querySelectorAll<HTMLElement>(
    [
      // PRs
      '.timeline-comment-actions details-menu.dropdown-menu',
      // Advisories
      '.timeline-comment-header details-menu.dropdown-menu',
      // It's too difficult to handle for issues right now, so skipping
    ].join(', '),
  )
  for (const menu of menus) handleMenu(menu)

  async function handleMenu(menu: HTMLElement) {
    if (analyzedEls.has(menu)) return
    analyzedEls.add(menu)

    // Wait until the menu opens before continuing
    try {
      await waitUntilInView(menu)
    } catch {
      // Element is no longer in view
      return
    }

    // Wait until finish loading too
    const loadingSpinner = menu.querySelector<HTMLElement>('svg[aria-label="Loading..."]')
    if (loadingSpinner) {
      await waitUntilDisconnected(loadingSpinner)
    }

    const header = menu.closest('.timeline-comment-header, .timeline-comment-group')
    if (!header) return

    const authorEl = header.querySelector<HTMLAnchorElement>('a.author')
    if (!authorEl) return

    const username = getUsername(authorEl)
    if (!username) return

    const userId =
      header
        .querySelector('img[src^="https://avatars.githubusercontent.com/u/"]')
        ?.getAttribute('src')
        ?.match(/\/u\/(\d+)\?/)?.[1] ??
      // The advisory first comment may not have an avatar, so search it somewhere else
      document
        .querySelector(
          `a[data-hovercard-url="/users/${username}/hovercard"] > img[src^="https://avatars.githubusercontent.com/u/"]`,
        )
        ?.getAttribute('src')
        ?.match(/\/u\/(\d+)\?/)?.[1]
    if (!userId) return

    const insertAnchor =
      menu.querySelector('a[aria-label="Report abusive content"]') ??
      menu.querySelector('a[aria-label="Report content"]') ??
      menu.querySelector('a[href^="/contact/report-content"]')

    // Add the report buttons
    const reportMisclassButton = document.createElement('a')
    reportMisclassButton.classList.add('dropdown-item', 'btn-link')
    reportMisclassButton.href = buildSimpleReportMisclassIssueUrl(username, userId)
    reportMisclassButton.target = '_blank'
    reportMisclassButton.textContent = 'Report misclassification'
    reportMisclassButton.setAttribute('aria-label', 'Report misclassification')
    if (insertAnchor) {
      insertAnchor.insertAdjacentElement('afterend', reportMisclassButton)
    } else {
      menu.appendChild(reportMisclassButton)
    }

    const reportUserButton = document.createElement('a')
    reportUserButton.classList.add('dropdown-item', 'btn-link')
    reportUserButton.href = buildSimpleReportUserIssueUrl(username, userId)
    reportUserButton.target = '_blank'
    reportUserButton.textContent = 'Report to AgentScan'
    reportUserButton.setAttribute('aria-label', 'Report to AgentScan')
    if (insertAnchor) {
      insertAnchor.insertAdjacentElement('afterend', reportUserButton)
    } else {
      menu.appendChild(reportUserButton)
    }

    // Update the report button href with a more complete link later as it may take a while,
    // and we want to show the report button first
    const result = await getIdentifyResult(username)
    if (!result) return

    // The element could have been removed if the fetch took too long and the user navigated away
    if (reportMisclassButton.isConnected) {
      reportMisclassButton.href = buildFullReportMisclassIssueUrl(username, userId, result)
    }
    if (reportUserButton.isConnected) {
      reportUserButton.href = buildFullReportUserIssueUrl(username, userId, result)
    }
  }
}

function buildSimpleReportUserIssueUrl(username: string, userId: string): string {
  const url = new URL('https://github.com/matteogabriele/agentscan/issues/new')
  url.searchParams.set('template', 'report-automated-account.yml')
  url.searchParams.set('title', `[AUTOMATION] ${username}`)
  url.searchParams.set('username', username)
  url.searchParams.set('user-id', userId)

  url.searchParams.set('evidence', `- Flagged in: ${withoutBacklink(location.href)}`)

  return url.toString()
}

// From agentscan-action
function buildFullReportUserIssueUrl(
  username: string,
  userId: string,
  result: IdentifyResult,
): string {
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

function buildSimpleReportMisclassIssueUrl(username: string, userId: string): string {
  const url = new URL('https://github.com/unveil-project/identity/issues/new')
  url.searchParams.set(
    'body',
    `\
The user \`${username}\` (id: \`${userId}\`) is misclassified.

- https://agentscan.tools/user/${username}
- Flagged in: ${withoutBacklink(location.href)}

_Explain why_`,
  )

  return url.toString()
}

function buildFullReportMisclassIssueUrl(
  username: string,
  userId: string,
  result: IdentifyResult,
): string {
  const url = new URL('https://github.com/unveil-project/identity/issues/new')
  url.searchParams.set(
    'body',
    `\
The user \`${username}\` (id: \`${userId}\`) is misclassified as "${result.classification}" (score ${result.score}/100).

- https://agentscan.tools/user/${username}
- Flagged in: ${withoutBacklink(location.href)}

_Explain why_`,
  )

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
