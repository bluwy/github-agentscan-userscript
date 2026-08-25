import { identify } from './features/identify.ts'
import { report } from './features/report.ts'
import { debounce } from './utils-debounce.ts'

// esbuild define
declare global {
  const API_URL: string
}

const run = debounce(() => {
  identify()
  report()
}, 200)

// listen to github page loaded event
document.addEventListener('pjax:end', () => run())
document.addEventListener('turbo:render', () => run())

// listen to react render changes
const observer = new MutationObserver(() => run())
observer.observe(document.body, { childList: true, subtree: true })
