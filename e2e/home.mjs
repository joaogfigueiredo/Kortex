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
const WD = new Date().getDay();
const WD_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
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
const goalsToday = () => api('GET', `/goals/day?date=${TODAY}`);

for (const g of await api('GET', '/goals')) await api('DELETE', `/goals/${g.id}`);
const agua = await api('POST', '/goals', { title: 'Beber 2L de água', icon: 'droplet' });
await api('POST', '/goals', { title: 'Ler 20 páginas', icon: 'book-open' });
await api('POST', '/goals', { title: 'Revisar agenda de amanhã', icon: 'calendar-check' });
for (const d of [-1, -2, -3, -4])
  await api('PUT', `/goals/${agua.id}/checks/${plus(d)}`, { done: true });

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
const goalBtn = (t) => `#metas button[role="checkbox"]`;

try {
  await page.setViewport({ width: 1440, height: 1300 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#metas button[role="checkbox"]');

  let t = await text();
  ok(t.includes('0/3 metas'), 'hero mostra 0/3 metas');
  ok(
    await page.$('[aria-label="Sequência: 4"]'),
    'meta "água" mostra sequência 4 (dias anteriores)',
  );
  await page.screenshot({ path: OUT + 'home-light.png' });

  // marcar água
  await page.$$eval('#metas button[role="checkbox"]', (bs) =>
    bs.find((b) => b.textContent.includes('água')).click(),
  );
  await sleep(600);
  ok((await goalsToday()).find((g) => g.title.includes('água')).done, 'check salva no servidor');
  t = await text();
  ok(t.includes('1/3 metas'), 'hero atualiza para 1/3');
  ok(await page.$('[aria-label="1 de 3 metas feitas hoje"]'), 'anel de progresso 1 de 3');
  ok(await page.$('[aria-label="Sequência: 5"]'), 'sequência sobe para 5 ao fazer hoje');

  // completar todas → toast
  for (const name of ['Ler 20', 'Revisar agenda']) {
    await page.$$eval(
      '#metas button[role="checkbox"]',
      (bs, n) => bs.find((b) => b.textContent.includes(n)).click(),
      name,
    );
    await sleep(500);
  }
  await page.waitForFunction(() =>
    document.body.textContent.includes('Todas as metas de hoje feitas'),
  );
  ok(true, 'toast de dia perfeito');
  await page.screenshot({ path: OUT + 'home-all-done.png' });

  // desmarcar uma
  await page.$$eval('#metas button[role="checkbox"]', (bs) =>
    bs.find((b) => b.textContent.includes('Revisar')).click(),
  );
  await sleep(500);
  ok(
    !(await goalsToday()).find((g) => g.title.includes('Revisar')).done,
    'desmarcar remove o check',
  );

  // gerenciar: nova meta só no dia de hoje; outra só amanhã
  await page.click('button[aria-label="Gerenciar metas"]');
  await page.waitForSelector('dialog[open]');
  const addGoal = async (title, icon, dayIdx) => {
    await page.$$eval('dialog[open] button', (bs) =>
      bs.find((b) => b.textContent.trim() === 'Nova meta').click(),
    );
    await page.type('dialog[open] input', title);
    await page.click(`dialog[open] button[aria-label="${icon}"]`);
    for (let d = 0; d < 7; d++) {
      const on = await page.$eval(
        `dialog[open] button[aria-label="${WD_NAMES[d]}"]`,
        (b) => b.getAttribute('aria-pressed') === 'true',
      );
      if (on !== (d === dayIdx))
        await page.click(`dialog[open] button[aria-label="${WD_NAMES[d]}"]`);
    }
    await page.$$eval('dialog[open] button[type="submit"]', (bs) => bs[0].click());
    await sleep(600);
  };
  await addGoal('Meditar 10 min', 'Mente', WD);
  await addGoal('Faxina', 'Folha', (WD + 1) % 7);
  await page.screenshot({ path: OUT + 'home-goals-modal.png' });
  // desativar "Ler"
  await page.click('dialog[open] button[aria-label="Ler 20 páginas ativa"]');
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(500);
  const titles = (await goalsToday()).map((g) => g.title);
  ok(titles.includes('Meditar 10 min'), 'meta do dia de hoje aparece');
  ok(!titles.includes('Faxina'), 'meta de outro dia da semana não aparece hoje');
  ok(!titles.includes('Ler 20 páginas'), 'meta desativada sai do dia');
  const domTitles = await page.$$eval('#metas button[role="checkbox"]', (bs) =>
    bs.map((b) => b.textContent),
  );
  ok(
    domTitles.some((x) => x.includes('Meditar')) && !domTitles.some((x) => x.includes('Ler 20')),
    'lista da Home reflete as mudanças',
  );

  // refeição compacta na Home
  const meals = (await api('GET', `/wellness/day?date=${TODAY}`)).meals;
  if (meals.length) {
    const target = meals.find((m) => !m.log) ?? meals[0];
    if (target.log) await api('DELETE', `/meals/${target.id}/logs/${TODAY}`);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click(`button[aria-label="${target.name}: Feita"]`);
    await sleep(500);
    const after = (await api('GET', `/wellness/day?date=${TODAY}`)).meals.find(
      (m) => m.id === target.id,
    );
    ok(after.log?.status === 'done', `marcar refeição direto da Home (${target.name})`);
  }
  ok((await text()).includes('Metas cumpridas'), 'retrato da semana presente');

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await sleep(300);
  await page.screenshot({ path: OUT + 'home-dark.png' });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#metas button[role="checkbox"]');
  ok(
    (await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
    )) <= 0,
    'sem rolagem horizontal no celular',
  );
  await page.screenshot({ path: OUT + 'home-mobile-dark.png', fullPage: true });

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
