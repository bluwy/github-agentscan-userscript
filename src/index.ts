import { identify } from './features/identify.ts'
import { report } from './features/report.ts'
import { debounce } from './utils-debounce.ts'

// esbuild define
declare global {
  const API_URL: string
}

run()

// listen to github page loaded event
document.addEventListener('pjax:end', () => run())
document.addEventListener('turbo:render', () => run())

// listen to react render changes
const observer = new MutationObserver(debounce(run, 200))
observer.observe(document.body, { childList: true, subtree: true })

function run() {
  identify()
  report()
}
