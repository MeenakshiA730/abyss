const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait for 3D scene to load

    console.log('=== Console Errors ===');
    if (errors.length === 0) {
      console.log('No console errors!');
    } else {
      errors.forEach(err => console.log('ERROR:', err));
    }

    // Check if canvas exists
    const canvas = await page.$('canvas');
    if (canvas) {
      console.log('Canvas found - 3D scene rendered');
    } else {
      console.log('WARNING: No canvas found');
    }

  } catch (e) {
    console.log('Navigation error:', e.message);
  }

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();