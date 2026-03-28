/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Build @caffecode/worker dist before Next.js build.
 *
 * Resolves the worker package via Node.js module resolution (follows
 * pnpm symlinks correctly) and runs tsc on its tsconfig.json.
 * This ensures dist/ exists for webpack to bundle.
 */
const { execFileSync } = require('child_process')
const path = require('path')

const workerDir = path.dirname(require.resolve('@caffecode/worker/package.json'))
const tsconfig = path.join(workerDir, 'tsconfig.json')

console.log(`[build-worker] Worker dir: ${workerDir}`)
console.log(`[build-worker] Building with tsconfig: ${tsconfig}`)

execFileSync('npx', ['tsc', '--project', tsconfig], { stdio: 'inherit' })

console.log('[build-worker] Worker build complete')
