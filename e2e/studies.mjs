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
const pad = (n) => String(n).padStart(2, '0');
const ds = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = (n) => {
  const d = new Date();
  d.setHours(12);
  d.setDate(d.getDate() + n);
  return ds(d);
};
const TODAY = plus(0);
const api = async (method, path, body) => {
  const r = await fetch(BASE + '/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.status === 204 ? null : r.json();
};
const ok = (c, m) => {
  if (!c) throw new Error('FALHOU: ' + m);
  console.log('✔', m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const subjects = () => api('GET', `/studies?today=${TODAY}`);

for (const s of await subjects()) await api('DELETE', `/studies/${s.id}`);
const eng = await api('POST', `/studies?today=${TODAY}`, {
  name: 'Inglês',
  color: '#B79CFF',
  level: 'intermediate',
  progress: 60,
  targetHours: 100,
});
const ts = await api('POST', `/studies?today=${TODAY}`, {
  name: 'TypeScript',
  color: '#6FE3FF',
  progress: 95,
});
const calc = await api('POST', `/studies?today=${TODAY}`, { name: 'Cálculo', color: '#FFD166' });
for (const [ref, d, min] of [
  [eng.id, -3, 40],
  [eng.id, -2, 30],
  [ts.id, -1, 50],
  [eng.id, -1, 20],
  [ts.id, -6, 60],
  [calc.id, -12, 45],
])
  await api('POST', '/time', {
    module: 'study',
    refId: ref,
    startedAt: `${plus(d)}T20:00`,
    durationSec: min * 60,
  });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--blink-settings=preferredColorScheme=1'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const text = async () => (await page.evaluate(() => document.body.textContent)).replace(/\s/g, ' ');
const clickBtn = (t, scope = '') =>
  page.$$eval(
    `${scope} button`,
    (bs, t) => {
      const b = bs.find((x) => x.textContent.trim() === t);
      if (!b) throw new Error('botão não encontrado: ' + t);
      b.click();
    },
    t,
  );

try {
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(BASE + '/estudos', { waitUntil: 'networkidle0' });
  await page.waitForSelector('article');

  let t = await text();
  ok(t.includes('3 dias'), 'sequência: 3 dias (até ontem; hoje ainda sem estudo)');
  ok(t.includes('3h 20min'), 'últimos 7 dias somam 3h 20min (Cálculo de 12 dias atrás fora)');
  ok(
    t.includes('Esfriando') || (await page.$('span[title="Parada há mais de uma semana"]')),
    'Cálculo marcado como parado/esfriando',
  );
  const rows = await page.$$eval('figure table tbody tr', (r) => r.length);
  ok(rows === 7, 'gráfico tem tabela equivalente com 7 dias');
  await page.screenshot({ path: OUT + 'studies-light.png' });

  // registrar sessão de 45min em TypeScript via preset
  await page.$$eval('article', (as) => {
    const a = as.find((x) => x.textContent.includes('TypeScript'));
    [...a.querySelectorAll('button')].find((b) => b.textContent.includes('Sessão')).click();
  });
  await page.waitForSelector('dialog[open]');
  await clickBtn('45min', 'dialog[open]');
  await page.type('dialog[open] textarea', 'Generics e utility types');
  await page.click('dialog[open] button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await sleep(400);
  const tsNow = (await subjects()).find((s) => s.name === 'TypeScript');
  ok(
    tsNow.sessions === 3 && tsNow.lastStudiedAt.startsWith(TODAY),
    'sessão de hoje registrada (3 sessões)',
  );
  t = await text();
  ok(t.includes('4 dias'), 'sequência sobe para 4 dias ao estudar hoje');
  ok(
    await page.evaluate(() =>
      [...document.querySelectorAll('figure span')].some((s) => s.textContent === '45min'),
    ),
    'barra de hoje mostra rótulo direto 45min',
  );

  // progresso -> 100% pelo slider no modal, depois subir de nível pelo card
  await page.$$eval('article', (as) =>
    as
      .find((a) => a.querySelector('h2')?.textContent === 'TypeScript')
      .querySelector(':scope > button')
      .click(),
  );
  await page.waitForSelector('dialog[open] #progress-range');
  await page.$eval('dialog[open] #progress-range', (el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, '100');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  ok(
    await page.$eval('dialog[open]', (d) => d.textContent.includes('Generics e utility types')),
    'modal lista as sessões com anotação',
  );
  await page.screenshot({ path: OUT + 'studies-modal.png' });
  await page.click('dialog[open] button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await sleep(400);
  await page.$$eval('article', (as) => {
    const a = as.find((x) => x.textContent.includes('TypeScript'));
    [...a.querySelectorAll('button')].find((b) => b.textContent.includes('Intermediário')).click();
  });
  await sleep(500);
  const leveled = (await subjects()).find((s) => s.name === 'TypeScript');
  ok(
    leveled.level === 'intermediate' && leveled.progress === 0,
    'subir de nível: Iniciante → Intermediário e progresso zera',
  );

  // arquivar Cálculo
  await page.$$eval('article', (as) =>
    as
      .find((a) => a.querySelector('h2')?.textContent === 'Cálculo')
      .querySelector(':scope > button')
      .click(),
  );
  await page.waitForSelector('dialog[open]');
  await clickBtn('Arquivar', 'dialog[open]');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await sleep(400);
  ok((await page.$$('article')).length === 2, 'arquivada some da aba Ativas');
  await page.$$eval('button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.includes('Arquivadas')).click(),
  );
  await sleep(200);
  ok(
    (await page.$$eval('article h2', (h) => h.map((x) => x.textContent))).join() === 'Cálculo',
    'aba Arquivadas mostra Cálculo',
  );
  await page.$$eval('button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.includes('Ativas')).click(),
  );

  // excluir uma sessão pelo modal
  await page.$$eval('article', (as) =>
    as
      .find((a) => a.querySelector('h2')?.textContent === 'Inglês')
      .querySelector(':scope > button')
      .click(),
  );
  await page.waitForSelector('dialog[open] button[aria-label="Excluir sessão"]');
  await page.click('dialog[open] button[aria-label="Excluir sessão"]');
  await sleep(500);
  ok(
    (await subjects()).find((s) => s.name === 'Inglês').sessions === 2,
    'excluir sessão atualiza a contagem',
  );
  await page.keyboard.press('Escape');

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await sleep(300);
  await page.hover('figure div.flex-1.items-end:last-child');
  await sleep(200);
  await page.screenshot({ path: OUT + 'studies-dark.png' });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('article');
  await page.screenshot({ path: OUT + 'studies-mobile-dark.png', fullPage: true });

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
