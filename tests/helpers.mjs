// Utilitários de teste: servidor estático + Chromium com three local roteado.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); } catch {}
  for (const p of ['/usr/local/lib/node_modules_global/playwright', '/usr/local/lib/node_modules/playwright', '/usr/lib/node_modules/playwright']) {
    try { return require(p); } catch {}
  }
  throw new Error('playwright não encontrado (defina NODE_PATH)');
}

export const THREE_DIR = process.env.THREE_DIR ||
  '/tmp/claude-0/-home-user-joguin/d367b80e-1c3f-5352-a984-1809df429e7e/scratchpad/node_modules/three';

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
    s.on('error', rej);
  });
}

export async function startServer(root) {
  const port = await freePort();
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(url + '/'); if (r.ok || r.status) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return { url, stop: () => proc.kill() };
}

export async function launch() {
  const { chromium } = loadPlaywright();
  return chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

const THREE_PREFIX = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';

export async function openPage(browser, url, { width = 390, height = 844, isMobile = false, hasTouch = false, deviceScaleFactor = 1 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile, hasTouch, deviceScaleFactor });
  const errors = [];
  const blocked = [];
  await context.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.startsWith(THREE_PREFIX)) {
      const rest = u.slice(THREE_PREFIX.length).split('?')[0];
      try {
        const body = await readFile(path.join(THREE_DIR, rest));
        return route.fulfill({ status: 200, contentType: 'text/javascript', body });
      } catch (e) {
        errors.push('three local ausente: ' + rest);
        return route.abort();
      }
    }
    if (u.startsWith('https://fonts.googleapis.com')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (u.startsWith('https://fonts.gstatic.com')) return route.fulfill({ status: 200, body: '' });
    if (u.startsWith('http://127.0.0.1') || u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    blocked.push(u);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  await page.goto(url);
  return { page, context, errors, blocked };
}
