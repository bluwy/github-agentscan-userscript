import { getIdentifyResult } from '../identify-result.ts'
import { getUsername } from '../utils-username.ts'
import { waitUntilInView } from '../utils-wait.ts'

const analyzedUserElements = new WeakSet<HTMLElement>()

export function identify() {
  const authorEls = document.querySelectorAll<HTMLAnchorElement>(
    [
      // PR
      'a.author',
      // Issue
      'a[class*="IssueBodyHeaderAuthor"]',
      'a[class*="ActivityHeader-module__AuthorName"]',
      // PR list
      '.opened-by > a',
      // Issue list
      'a[class*="IssueItem-module__authorCreatedLink"]',
      // Home page
      'a.Link[data-hovercard-type="user"][data-octo-dimensions="link_type:self"]',
      // Commits page
      'a[class*="AuthorAvatar-module__authorHoverableLink"]',
      'a[class*="AuthorLink-module__authorNameLink"]',
    ].join(', '),
  )
  for (const authorEl of authorEls) {
    if (analyzedUserElements.has(authorEl)) continue
    analyzedUserElements.add(authorEl)

    const parent = authorEl.parentElement
    if (!parent) continue

    const alreadyLabeled = parent.querySelector('[data-github-agentscan-userscript]')
    if (alreadyLabeled) continue

    // Check adjacent label if is already a bot
    const isAlreadyBot = Array.from(
      parent.querySelectorAll(
        [
          // PR
          'span.Label',
          // Issue
          'span[data-component="Label"]',
          // PR list
          'span.tooltipped > span.Label',
        ].join(', '),
      ),
    ).find((label) => {
      const text = label.textContent?.trim().toLowerCase()
      return text === 'ai' || text === 'bot'
    })
    if (isAlreadyBot) continue

    const username = getUsername(authorEl)
    if (!username) continue

    // May appear in some pages that don't show the label, like commits page
    if (username.endsWith('[bot]')) continue

    identifyUsername(username, authorEl).catch((err) => {
      console.error('Error fetching identify result for user', username, err)
    })
  }
}

async function identifyUsername(username: string, authorEl: HTMLAnchorElement) {
  try {
    await waitUntilInView(authorEl)
  } catch {
    // Element is no longer in view
    return
  }

  const identifyResult = await getIdentifyResult(username)
  const agentscanLink = `https://agentscan.tools/user/${username}`

  let label: HTMLSpanElement | null = null
  if (identifyResult.isCommunityFlagged) {
    label = createLabel(
      'AI',
      agentscanLink,
      'Label--danger',
      'This user has been flagged as AI by the community',
    )
  } else if (identifyResult.classification === 'automation') {
    label = createLabel(
      'AI',
      agentscanLink,
      'Label--severe',
      'This user has been flagged as automation by AgentScan',
    )
  } else if (identifyResult.classification === 'mixed') {
    label = createLabel(
      'AI',
      agentscanLink,
      'Label--warning',
      'This user has been flagged as mixed by AgentScan',
    )
  } else if (false) {
    // For debugging
    label = createLabel('Human', agentscanLink, 'Label--secondary', 'Living and breathing')
  }

  if (label && authorEl.parentElement) {
    const parentStyle = getComputedStyle(authorEl.parentElement)
    const alreadyHasMargin = parentStyle.display === 'flex' && parentStyle.gap.endsWith('px')
    if (!alreadyHasMargin) {
      ;(label.childNodes[0] as HTMLElement).classList.add('ml-1')
    }
  }

  if (label) {
    authorEl.insertAdjacentElement('afterend', label)
  }
}

function createLabel(
  text: string,
  link: string,
  labelClass: string,
  description: string,
): HTMLSpanElement {
  const label = document.createElement('span')
  label.className = 'tooltipped tooltipped-n'
  label.ariaLabel = description
  label.dataset.viewComponent = 'true'
  label.dataset.githubAgentscanUserscript = ''
  const child = document.createElement('a')
  child.className = ['Label', labelClass].filter(Boolean).join(' ')
  child.textContent = text
  child.href = link
  child.target = '_blank'
  label.appendChild(child)
  return label
}
