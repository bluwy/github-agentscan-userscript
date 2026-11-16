// https://github.com/MatteoGabriele/agentscan-action/blob/main/src/known-bots.ts
const knownBots = new Set([
  'agentscanapp',
  'copilot',
  'dependabot',
  'dependabot-preview',
  'renovate',
  'renovate-bot',
  'greenkeeper',
  'github-actions',
  'stale',
  'snyk-bot',
  'codecov',
  'codecov-commenter',
  'coveralls',
  'travis-ci',
  'circleci',
  'appveyor',
  'azure-pipelines',
  'netlify',
  'vercel',
  'heroku',
  'aws-amplify',
  'eslintbot',

  // Additional by userscript
  'ghost',
  'rustbot',
  'rust-rfcbot',
  'BrewTestBot',
  'babel-bot',
  'typescript-bot',
  'nodejs-github-bot',
])

export function isKnownBot(username: string): boolean {
  username = username.toLowerCase()
  return username.endsWith('[bot]') || knownBots.has(username)
}
