import { getIdentifyResult } from '../identify-result.ts'
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
    ].join(', '),
  )
  for (const authorEl of authorEls) {
    if (analyzedUserElements.has(authorEl)) continue
    analyzedUserElements.add(authorEl)

    const parent = authorEl.parentElement
    if (!parent) continue

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

    const username = authorEl.textContent?.trim()
    if (!username) continue

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

  let label: HTMLSpanElement | null = null
  if (identifyResult.isCommunityFlagged) {
    label = createLabel('AI', 'Label--danger', 'This user has been flagged as AI by the community')
  } else if (identifyResult.classification === 'automation') {
    label = createLabel(
      'AI',
      'Label--severe',
      'This user has been flagged as automation by AgentScan',
    )
  } else if (identifyResult.classification === 'mixed') {
    label = createLabel('AI', 'Label--warning', 'This user has been flagged as mixed by AgentScan')
  } else {
    // For debugging
    // label = createLabel('Human', 'Label--secondary', 'Living and breathing')
  }

  if (label) {
    authorEl.insertAdjacentElement('afterend', label)
  }
}

function createLabel(text: string, labelClass: string, description: string): HTMLSpanElement {
  const label = document.createElement('span')
  label.className = 'tooltipped tooltipped-n'
  label.ariaLabel = description
  label.dataset.viewComponent = 'true'
  const child = document.createElement('span')
  child.className = ['ml-1 Label', labelClass].filter(Boolean).join(' ')
  child.textContent = text
  label.appendChild(child)
  return label
}
