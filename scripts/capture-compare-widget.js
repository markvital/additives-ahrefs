const { chromium } = require('playwright');

async function captureCompareWidget() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:3005/', { waitUntil: 'networkidle' });
  await page.waitForSelector('main');

  await page.evaluate(() => {
    const headerButton = document.querySelector('aside [role="button"]');
    headerButton?.click();
  });

  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const firstSlot = document.querySelector('[data-compare-slot="0"]');
    if (firstSlot instanceof HTMLElement) {
      firstSlot.click();
    }
  });

  await page.waitForTimeout(400);

  await page.type('input[aria-label="Search additives"]', 'sa');
  await page.waitForTimeout(600);

  await page.screenshot({
    path: '_tmp/screenshots/compare-widget-selector.png',
    fullPage: false,
    clip: {
      x: 0,
      y: 320,
      width: 1440,
      height: 560,
    },
  });

  await browser.close();
}

captureCompareWidget().catch((error) => {
  console.error(error);
  process.exit(1);
});
