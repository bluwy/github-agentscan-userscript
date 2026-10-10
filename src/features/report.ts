import { getIdentifyResult } from '../identify-result.ts'
import { getUsername } from '../utils-username.ts'
import { waitUntilInView } from '../utils-wait.ts'

const analyzedEls = new WeakSet<HTMLElement>()

export function report() {
  const menus = document.querySelectorAll<HTMLAnchorElement>(
    [
      // PRs
      '.timeline-comment-actions details-menu.dropdown-menu',
      // Advisories
      '.timeline-comment-header details-menu.dropdown-menu',
      // It's too difficult to handle for issues right now, so skipping
    ].join(', '),
  )
  for (const menu of menus) {
    if (analyzedEls.has(menu)) continue
    analyzedEls.add(menu)

    const header = menu.closest('.timeline-comment-header, .timeline-comment-group')
    if (!header) continue

    const authorEl = header.querySelector<HTMLAnchorElement>('a.author')
    if (!authorEl) continue

    const username = getUsername(authorEl)
    if (!username) continue

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
    if (!userId) continue

    const insertAnchor =
      menu.querySelector<HTMLElement>('a[aria-label="Report abusive content"]') ??
      menu.querySelector<HTMLElement>('a[aria-label="Report content"]') ??
      menu.querySelector<HTMLElement>('a[href^="/contact/report-content"]')

    // Add the report button
    const reportButton = document.createElement('a')
    reportButton.classList.add('dropdown-item', 'btn-link')
    reportButton.href = buildSimpleReportIssueUrl(username, userId)
    reportButton.target = '_blank'
    reportButton.textContent = 'Report to AgentScan'
    reportButton.setAttribute('aria-label', 'Report to AgentScan')
    if (insertAnchor) {
      insertAnchor.insertAdjacentElement('afterend', reportButton)
    } else {
      menu.appendChild(reportButton)
    }

    // Update the report button href with a more complete link later as it may take a while,
    // and we want to show the report button first
    buildFullReportIssueUrl(username, userId, authorEl)
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
async function buildFullReportIssueUrl(
  username: string,
  userId: string,
  authorEl: HTMLAnchorElement,
): Promise<string | null> {
  try {
    await waitUntilInView(authorEl)
  } catch {
    // Element is no longer in view
    return null
  }

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
