import puppeteer from 'puppeteer-core';
import { CHROME, OUT } from './lib.mjs';

// ── Proteção: só roda contra o servidor de TESTE (porta 5199, banco test.db) ──
{
  const h = await (await fetch('http://localhost:5199/api/health')).json().catch(() => ({}));
  if (h.db !== 'test.db') {
    console.error('ABORTADO: servidor não está usando test.db (db=' + h.db + ')');
    process.exit(3);
  }
}

const BASE = 'http://localhost:5199';
const get = async () => (await fetch(BASE + '/api/ideas')).json();
const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto(BASE + '/ideias', { waitUntil: 'networkidle0' });
await p.waitForSelector('article');
// foca o card "App de receitas" (coluna 1) e move com o teclado para a coluna 2
const handle = await p.evaluateHandle(
  () =>
    [...document.querySelectorAll('article')].find((a) => a.textContent.includes('App de receitas'))
      .parentElement,
);
await handle.focus();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.keyboard.press('Space');
await sleep(300);
await p.keyboard.press('ArrowRight');
await sleep(400);
await p.keyboard.press('Space');
await sleep(800);
const it = (await get()).find((i) => i.title.startsWith('App de receitas'));
console.log(it.status === 'started' ? '✔ teclado moveu para "started"' : '✘ status=' + it.status);
// Enter abre o modal (re-busca: o card remontou na nova coluna)
const h2 = await p.evaluateHandle(
  () =>
    [...document.querySelectorAll('article')].find((a) => a.textContent.includes('App de receitas'))
      .parentElement,
);
await h2.focus();
await p.keyboard.press('Enter');
await sleep(300);
console.log((await p.$('dialog[open]')) ? '✔ Enter abre o modal' : '✘ Enter não abriu');
await p.keyboard.press('Escape');
await sleep(200);
console.log((await p.$('dialog[open]')) ? '✘ Esc não fechou' : '✔ Esc fecha o modal');
await p.screenshot({ path: OUT + 'ideas-after-kbd.png' });
await b.close();
