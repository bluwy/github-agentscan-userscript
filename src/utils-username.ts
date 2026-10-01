export function getUsername(authorEl: HTMLAnchorElement): string | undefined {
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

  // Apply simple validation
  if (fromText && /^[a-zA-Z0-9-]+$/.test(fromText)) return fromText
}
