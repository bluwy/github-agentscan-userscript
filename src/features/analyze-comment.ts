import { analyzeText } from '@unveil/interlinked'
import TurndownService from 'turndown'
// @ts-expect-error
import { gfm } from 'turndown-plugin-gfm'
import { isAlreadyBotOrAI } from '../utils-username.ts'
import { waitUntilInView } from '../utils-wait.ts'

const analyzedEls = new WeakSet<HTMLElement>()

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  hr: '---',
})
turndownService.use(gfm)
// Remove blockquotes as these are not text by the comment author
turndownService.addRule('removeBlockquotes', {
  filter: 'blockquote',
  replacement: () => '',
})
// Remove details but keep summary. Details can sometimes be used to write verbose
// additional context which we don't want to incorrectly analyze as AI
turndownService.addRule('removeDetails', {
  filter: 'details',
  replacement: (_, node) => {
    const summary = node.querySelector('summary')
    return summary?.textContent || ''
  },
})

export function analyzeComment() {
  const commentBlocks = document.querySelectorAll<HTMLElement>(
    [
      // Issue
      '.react-issue-body',
      '[class*="IssueCommentContent__"]',
      // PR
      '.js-comment',
      // Advisories
      '.js-repository-advisory-details',
    ].join(','),
  )

  for (const block of commentBlocks) {
    if (analyzedEls.has(block)) continue
    analyzedEls.add(block)

    analyzeCommentBlock(block)
  }
}

async function analyzeCommentBlock(block: HTMLElement) {
  try {
    await waitUntilInView(block)
  } catch (err) {
    // Element is no longer in view
    return
  }

  // No need to continue if it's a known bot
  const authorEl = block.querySelector<HTMLAnchorElement>('a.author')
  if (authorEl && isAlreadyBotOrAI(authorEl)) return

  const commentBody = block.querySelector<HTMLElement>(
    [
      // Issue & Advisories
      '.markdown-body',
      // PR
      '.comment-body',
    ].join(','),
  )
  if (!commentBody) return

  let insertPoint = block.querySelector<HTMLElement>(
    [
      // Issue
      '[class*="badgeGroup__"]',
      '[class*="BadgesGroupContainer__"]',
      // PR
      '.timeline-comment-actions + div',
      // Advisories
      '.timeline-comment-header-text',
    ].join(','),
  )
  if (!insertPoint) return

  // For advisories, we need to manually add an insert point that's after the one we queried
  if (insertPoint.classList.contains('timeline-comment-header-text')) {
    const newDiv = document.createElement('div')
    newDiv.dataset.githubAgentscanUserscript = ''
    insertPoint.insertAdjacentElement('afterend', newDiv)
    insertPoint = newDiv
  }

  const alreadyLabeled = insertPoint.querySelector('[data-github-agentscan-userscript]')
  if (alreadyLabeled) return

  // NOTE: Ideally we also pass the issue template or PR template for more accurate analysis,
  // but those require multiple fetches to possibly private repos, and they don't easily
  // retroactively work if the template changes over time, so right now it's easier to just
  // analyze the comment as-is.
  //
  // NOTE 2: Passing the commentBody node instead of its innerHTML string is faster as turndown
  // doesn't need a re-parse of the HTML
  let markdown = turndownService.turndown(commentBody)
  // For issues, filter out the task list as it's usually from the template
  if (location.pathname.includes('/issues/')) {
    markdown = markdown.replace(/- \[( |x)\] .*/gi, '')
  }

  const result = analyzeText(markdown)
  let label: HTMLSpanElement | undefined

  if (result.classification === 'automation') {
    label = createLabel(
      'Writes like AI',
      'Label--attention',
      `This comment is flagged as automation by AgentScan Text\n` +
        `(score: ${result.score}, confidence: ${result.confidence}, signals: ${result.signals.length})`,
    )
  } else if (false) {
    // For debugging
    label = createLabel(
      'Writes like human',
      'Label--secondary',
      `Very nice (score: ${result.score}, confidence: ${result.confidence}, signals: ${result.signals.length})`,
    )
  }

  if (label) {
    // For advisories, adjust the styling only if there's label/content
    if (insertPoint.dataset.githubAgentscanUserscript !== undefined) {
      insertPoint.classList.add('mr-2')
    }
    insertPoint.appendChild(label)
  }
}

function createLabel(text: string, labelClass: string, description: string): HTMLSpanElement {
  const label = document.createElement('span')
  label.className = 'tooltipped tooltipped-n'
  label.ariaLabel = description
  label.dataset.viewComponent = 'true'
  label.dataset.githubAgentscanUserscript = ''
  const child = document.createElement('span')
  child.className = ['Label ml-1', labelClass].filter(Boolean).join(' ')
  child.textContent = text
  label.appendChild(child)
  return label
}
