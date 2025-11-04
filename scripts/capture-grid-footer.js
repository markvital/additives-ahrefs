const { chromium } = require('playwright');

async function captureGridFooter() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:3005/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-additive-card-index="0"]');

  await page.screenshot({
    path: '_tmp/screenshots/home-grid-footer.png',
    fullPage: false,
    clip: {
      x: 100,
      y: 200,
      width: 1240,
      height: 420,
    },
  });

  await browser.close();
}

captureGridFooter().catch((error) => {
  console.error(error);
  process.exit(1);
});
