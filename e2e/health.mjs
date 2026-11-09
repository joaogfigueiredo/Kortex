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
const isWeekend = [0, 6].includes(new Date().getDay());
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
const dayApi = (d = TODAY) => api('GET', `/wellness/day?date=${d}`);

// reset
for (const m of await api('GET', '/meals')) await api('DELETE', `/meals/${m.id}`);
for (const w of await api('GET', '/workouts?limit=500')) await api('DELETE', `/workouts/${w.id}`);
const cafe = await api('POST', '/meals', {
  name: 'Café da manhã',
  time: '07:30',
  description: 'Ovos, pão integral e fruta',
});
const almoco = await api('POST', '/meals', {
  name: 'Almoço',
  time: '12:30',
  description: 'Arroz, feijão, frango e salada',
});
await api('POST', '/meals', { name: 'Lanche', time: '16:00' });
await api('POST', '/meals', { name: 'Jantar', time: '20:00' });
// histórico dos dias anteriores
for (const [d, s1, s2] of [
  [-1, 'done', 'done'],
  [-2, 'done', 'partial'],
  [-3, 'skipped', 'done'],
]) {
  await api('PUT', `/meals/${cafe.id}/logs/${plus(d)}`, { status: s1 });
  await api('PUT', `/meals/${almoco.id}/logs/${plus(d)}`, { status: s2 });
}
await api('POST', '/workouts', {
  date: plus(-1),
  type: 'Musculação',
  durationMin: 60,
  intensity: 4,
});
await api('POST', '/workouts', { date: plus(-3), type: 'Corrida', durationMin: 35, intensity: 3 });
await api('POST', '/workouts', {
  date: plus(-5),
  type: 'Musculação',
  durationMin: 55,
  intensity: 4,
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

try {
  await page.setViewport({ width: 1440, height: 1200 });
  await page.goto(BASE + '/saude', { waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-label="Café da manhã: Feita"]');

  let t = await text();
  ok(
    t.includes('3/7') || t.includes('3 Dias ativos') || /Dias ativos\s*3\/7/.test(t),
    'dias ativos 3/7',
  );
  ok(t.includes('3 dias registrados'), 'aderência considera só os 3 dias registrados');
  await page.screenshot({ path: OUT + 'health-light.png' });

  // marcar refeições
  await page.click('button[aria-label="Café da manhã: Feita"]');
  await page.click('button[aria-label="Almoço: Parcial"]');
  await sleep(600);
  let d = await dayApi();
  ok(
    d.meals.find((m) => m.name === 'Café da manhã').log?.status === 'done',
    'café marcado como feito',
  );
  ok(
    d.meals.find((m) => m.name === 'Almoço').log?.status === 'partial',
    'almoço marcado como parcial',
  );
  ok((await text()).includes('4 dias registrados'), 'hoje passa a contar como dia registrado');
  await page.click('button[aria-label="Almoço: Parcial"]');
  await sleep(600);
  d = await dayApi();
  ok(d.meals.find((m) => m.name === 'Almoço').log === null, 'clicar de novo limpa a marcação');

  // registrar treino
  await page.$$eval('button[aria-pressed]', (bs) =>
    bs.find((b) => b.textContent.trim() === 'Corrida').click(),
  );
  await page.$$eval('button[aria-pressed]', (bs) =>
    bs.find((b) => b.textContent.trim() === '30 min').click(),
  );
  await page.click('button[role="radio"][aria-label^="4 "]');
  await page.$$eval('button[type="submit"]', (bs) =>
    bs.find((b) => b.textContent.trim() === 'Registrar').click(),
  );
  await sleep(700);
  d = await dayApi();
  ok(
    d.workouts.length === 1 &&
      d.workouts[0].type === 'Corrida' &&
      d.workouts[0].durationMin === 30 &&
      d.workouts[0].intensity === 4,
    'treino registrado (Corrida, 30 min, intensidade 4)',
  );
  t = await text();
  ok(t.includes('4/7'), 'dias ativos sobe para 4/7');
  ok(
    await page.evaluate(() =>
      [...document.querySelectorAll('figure span')].some((s) => s.textContent === '30 min'),
    ),
    'barra de hoje com rótulo 30 min',
  );

  // navegação de dia
  ok(
    await page.$eval('button[aria-label="Próximo dia"]', (b) => b.disabled),
    'não avança para o futuro',
  );
  await page.click('button[aria-label="Dia anterior"]');
  await page.waitForFunction(() => document.body.textContent.includes('Ontem'));
  await sleep(300);
  ok((await text()).includes('Musculação'), 'ontem mostra o treino de musculação');
  ok(
    await page.$eval(
      'button[aria-label="Café da manhã: Feita"]',
      (b) => b.getAttribute('aria-pressed') === 'true',
    ),
    'ontem mostra café já marcado',
  );
  await page.$$eval('button', (bs) => bs.find((b) => b.textContent.trim() === 'Hoje').click());
  await sleep(300);

  // plano: adicionar refeição de dias úteis e desativar o jantar
  await page.$$eval('button', (bs) => bs.find((b) => b.textContent.trim() === 'Plano').click());
  await page.waitForSelector('dialog[open]');
  await page.$$eval('dialog[open] button', (bs) =>
    bs.find((b) => b.textContent.includes('Adicionar refeição')).click(),
  );
  await page.type('dialog[open] input', 'Marmita');
  await page.$$eval('dialog[open] button', (bs) =>
    bs.find((b) => b.textContent.trim() === 'Dias úteis').click(),
  );
  await page.$$eval('dialog[open] button[type="submit"]', (bs) => bs[0].click());
  await sleep(500);
  await page.click('dialog[open] button[aria-label="Jantar ativa no plano"]');
  await sleep(500);
  await page.screenshot({ path: OUT + 'health-plan.png' });
  await page.keyboard.press('Escape');
  await sleep(400);
  const names = (await dayApi()).meals.map((m) => m.name);
  ok(!names.includes('Jantar'), 'jantar desativado sai do dia');
  ok(
    names.includes('Marmita') === !isWeekend,
    `marmita (dias úteis) ${isWeekend ? 'não aparece no fim de semana' : 'aparece hoje'}`,
  );

  // excluir treino
  await page.click('button[aria-label="Excluir Corrida"]');
  await sleep(500);
  ok((await dayApi()).workouts.length === 0, 'excluir treino');

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await sleep(300);
  await page.screenshot({ path: OUT + 'health-dark.png' });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-label="Café da manhã: Feita"]');
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
  );
  ok(overflow <= 0, `sem rolagem horizontal no celular (excesso: ${overflow}px)`);
  await page.screenshot({ path: OUT + 'health-mobile-dark.png', fullPage: true });

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
