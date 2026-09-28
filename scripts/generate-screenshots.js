// Captures the production React Native components, never a separately drawn UI.
(async () => {
  const { default: puppeteer } = await import('puppeteer');
  const { startPreview } = await import('./preview-server.mjs');
  const { mkdir, copyFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const assets = path.resolve(__dirname, '../assets');
  await mkdir(assets, { recursive: true });
  const preview = await startPreview();
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    for (const width of [1280, 390]) {
      for (const theme of ['dark', 'light']) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setViewport({ width, height: 800, deviceScaleFactor: 2 });
        await page.goto(`${preview.url}/?theme=${theme}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('[aria-label="Edit Review navigation"]');
        const file = width === 1280 ? `task-manager-overview-${theme}.png` : `task-manager-compact-${theme}.png`;
        await (await page.$('#surface')).screenshot({ path: path.join(assets, file) });
        if (width === 1280 && theme === 'dark') {
          await page.click('[aria-label="Create a task"]');
          await page.waitForSelector('[aria-label="Task title"]', { visible: true });
          await (await page.$('body')).screenshot({ path: path.join(assets, 'task-manager-create-task.png') });
        }
        if (width === 1280 && theme === 'light') {
          await page.click('[aria-label="Start an agent for Review navigation"]');
          await page.waitForFunction(() => document.body.innerText.includes('Sample provider'));
          await (await page.$('body')).screenshot({ path: path.join(assets, 'task-manager-agent-launch.png') });
        }
        if (errors.length) throw new Error(errors.join('\n'));
        await page.close();
      }
    }
    await copyFile(path.join(assets, 'task-manager-overview-dark.png'), path.join(assets, 'task-manager-overview.png'));
    await copyFile(path.join(assets, 'task-manager-compact-dark.png'), path.join(assets, 'task-manager-compact.png'));
    console.log('Captured actual Task Manager components at desktop and compact widths in both themes.');
  } finally {
    await browser?.close();
    await preview.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
