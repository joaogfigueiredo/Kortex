import puppeteer from 'puppeteer-core';
import { CHROME } from './lib.mjs';

// ── Proteção: só roda contra o servidor de TESTE (porta 5199, banco test.db) ──
{
  const h = await (await fetch('http://localhost:5199/api/health')).json().catch(() => ({}));
  if (h.db !== 'test.db') {
    console.error('ABORTADO: servidor não está usando test.db (db=' + h.db + ')');
    process.exit(3);
  }
}

const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
let bad = 0;
for (const r of [
  '/',
  '/ideias',
  '/projetos',
  '/financas',
  '/lembretes',
  '/estudos',
  '/saude',
  '/dashboard',
  '/configuracoes',
]) {
  await p.goto('http://localhost:5199' + r, { waitUntil: 'networkidle0' });
  await new Promise((res) => setTimeout(res, 300));
  // Kanbans rolam na horizontal DENTRO do board (esperado); o documento não pode rolar.
  const o = await p.evaluate(
    () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
  );
  if (o > 0) bad++;
  console.log(`${o > 0 ? '✘' : '✔'} ${r.padEnd(15)} excesso ${o}px`);
}
await b.close();
process.exit(bad ? 1 : 0);
