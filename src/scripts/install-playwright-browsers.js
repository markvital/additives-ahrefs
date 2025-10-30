#!/usr/bin/env node

const { spawnSync } = require('child_process');

function main() {
  const env = { ...process.env };

  if (env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1') {
    console.log('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 detected. Overriding to download required browsers.');
  }

  env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '0';
  if (!env.PLAYWRIGHT_BROWSERS_PATH || env.PLAYWRIGHT_BROWSERS_PATH.trim() === '') {
    env.PLAYWRIGHT_BROWSERS_PATH = '0';
  }

  const args = ['playwright', 'install', 'chromium'];

  if (process.platform === 'linux' && !process.env.VERCEL) {
    console.log(
      'Linux detected. If browser installation fails due to missing system dependencies, run `npx playwright install-deps` manually.'
    );
  }

  console.log('Ensuring Playwright Chromium browser is installed...');

  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(executable, args, {
    stdio: 'inherit',
    env,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

main();
