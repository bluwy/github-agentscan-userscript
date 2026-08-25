export function getUsername(authorEl: HTMLAnchorElement): string | undefined {
  const fromUrl = new URL(authorEl.href)
  const fromUrlPathnameParts = fromUrl.pathname.split('/')
  if (fromUrl.search === '' && fromUrlPathnameParts.length === 2) return fromUrlPathnameParts[1]

  const fromText = authorEl.textContent?.trim()
  if (fromText) return fromText
}
