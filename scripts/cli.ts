import { build, getUserscriptManagerOutDir } from '@bluwy/usb'

const isDev = process.argv[2] === 'dev'

await build({
  input: 'src/index.ts',
  outDir: 'dist',
  copyOutDir: [getUserscriptManagerOutDir('Userscripts')],
  watch: isDev,
  userscriptMeta: {
    name: 'GitHub AgentScan',
    namespace: 'https://github.com/bluwy',
    match: 'https://github.com/**',
    icon: 'https://www.google.com/s2/favicons?sz=64&domain=github.com',
    grant: ['GM.xmlHttpRequest'],
    connect: [isDev ? 'localhost' : 'github-agentscan-userscript.bjornlu.workers.dev'],
    'inject-into': 'content', // run in isolated context
  },
  esbuildOptions: {
    define: {
      API_URL: JSON.stringify(
        isDev ? 'http://localhost:8787' : 'https://github-agentscan-userscript.bjornlu.workers.dev',
      ),
    },
  },
})
