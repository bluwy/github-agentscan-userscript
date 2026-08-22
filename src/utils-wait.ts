import { debounce } from './utils-debounce.ts'

const inViewResolvers = new Map<HTMLElement, PromiseWithResolvers<void>>()

const inViewIntersectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue

    const element = entry.target as HTMLElement
    inViewIntersectionObserver.unobserve(element)
    inViewResolvers.get(element)?.resolve()
    inViewResolvers.delete(element)
  }
})

const inViewRemovalObserver = new MutationObserver(
  debounce(() => {
    for (const [element, resolvers] of inViewResolvers) {
      if (element.isConnected) continue

      inViewIntersectionObserver.unobserve(element)
      inViewResolvers.delete(element)
      resolvers.reject(new Error('Element was removed from the DOM'))
    }
  }, 200),
)
inViewRemovalObserver.observe(document, { childList: true, subtree: true })

export function waitUntilInView(element: HTMLElement): Promise<void> {
  const p = promiseWithResolvers<void>()

  if (!element.isConnected) {
    p.reject(new Error('Element is not connected to the DOM'))
    return p.promise
  }

  inViewResolvers.set(element, p)
  inViewIntersectionObserver.observe(element)

  return p.promise
}

function promiseWithResolvers<T>(): PromiseWithResolvers<T> {
  let resolve: (value: T | PromiseLike<T>) => void = () => {}
  let reject: (reason?: any) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
