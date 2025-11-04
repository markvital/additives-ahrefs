const { chromium } = require('playwright');

async function captureHeaderScreens() {
  const browser = await chromium.launch({ headless: true });

  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await desktopPage.goto('http://127.0.0.1:3005/', { waitUntil: 'networkidle' });
  await desktopPage.waitForSelector('header.site-header');
  await desktopPage.locator('header.site-header').screenshot({
    path: '_tmp/screenshots/header-desktop.png',
  });

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobilePage.goto('http://127.0.0.1:3005/', { waitUntil: 'networkidle' });
  const toggle = mobilePage.locator('.header-toggle');
  await toggle.waitFor({ state: 'visible' });
  await toggle.click();
  await mobilePage.waitForSelector('.header-nav[data-open="true"]');
  await mobilePage.locator('header.site-header').screenshot({
    path: '_tmp/screenshots/header-mobile-menu.png',
  });

  await browser.close();
}

captureHeaderScreens().catch((error) => {
  console.error(error);
  process.exit(1);
});
