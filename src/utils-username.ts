export function getUsername(authorEl: HTMLAnchorElement): string | undefined {
  if (isAlreadyBotOrAI(authorEl)) return undefined

  // If text content is empty, it might be just an image or something that links to the user,
  // so we skip it
  const fromText = authorEl.textContent?.trim().split(' ').at(-1)
  if (fromText === '') return undefined

  // If there's text content, we still check the href first to get the more accurate username,
  // e.g. "/username" links
  if (authorEl.href) {
    const fromUrl = new URL(authorEl.href)
    const fromUrlPathnameParts = fromUrl.pathname.split('/')
    if (fromUrl.search === '' && fromUrlPathnameParts.length === 2) return fromUrlPathnameParts[1]
  }

  // Apply simple validation. [bot] may appear in some pages that don't show the label, like commits page
  if (fromText && /^[a-zA-Z0-9-]+$/.test(fromText) && !fromText.endsWith('[bot]')) return fromText
}

function isAlreadyBotOrAI(authorEl: HTMLAnchorElement): boolean {
  const parent = authorEl.parentElement
  if (!parent) return false

  const isAlready = Array.from(
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
  ).some((label) => {
    // Skip our own added labels
    if (label.parentElement?.hasAttribute('data-github-agentscan-userscript')) return false

    const text = label.textContent?.trim().toLowerCase()
    return text === 'ai' || text === 'bot'
  })

  return isAlready
}
