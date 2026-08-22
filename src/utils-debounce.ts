export function debounce(cb: () => void, delay: number): () => void {
  let t: number | undefined

  return () => {
    if (t != null) clearTimeout(t)
    t = setTimeout(cb, delay)
  }
}
