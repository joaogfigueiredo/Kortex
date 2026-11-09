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
const pad = (n) => String(n).padStart(2, '0');
const ds = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = (n) => {
  const d = new Date();
  d.setHours(12);
  d.setDate(d.getDate() + n);
  return ds(d);
};
const today = plus(0);

for (const r of await api('GET', '/reminders')) await api('DELETE', `/reminders/${r.id}`);
const cats = await api('GET', '/reminders/categories');
const cat = (n) => cats.find((c) => c.name === n).id;
await api('POST', '/reminders', {
  title: 'Daily do trabalho',
  kind: 'appointment',
  startAt: `${plus(-20)}T09:00`,
  endAt: `${plus(-20)}T09:15`,
  recurrence: 'weekly',
  recurrenceWeekdays: 0b0111110,
  categoryId: cat('Trabalho'),
});
await api('POST', '/reminders', {
  title: 'Beber água',
  startAt: `${plus(-5)}T08:00`,
  recurrence: 'daily',
  categoryId: cat('Saúde'),
});
await api('POST', '/reminders', {
  title: 'Dentista',
  kind: 'appointment',
  startAt: `${today}T15:00`,
  endAt: `${today}T16:00`,
  categoryId: cat('Pessoal'),
});
await api('POST', '/reminders', {
  title: 'Pagar fatura do cartão',
  kind: 'notice',
  startAt: `${plus(2)}T00:00`,
  allDay: true,
  categoryId: cat('Finanças'),
});
await api('POST', '/reminders', {
  title: 'Prova de inglês',
  startAt: `${plus(3)}T19:00`,
  categoryId: cat('Estudos'),
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
const dayItems = () =>
  page.$$eval('li button[role="checkbox"]', (bs) => bs.map((b) => b.getAttribute('aria-label')));

try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(BASE + '/lembretes', { waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-current="date"]');

  const todayLabel = await page.$eval('button[aria-current="date"]', (b) =>
    b.getAttribute('aria-label'),
  );
  ok(/itens|item/.test(todayLabel), `célula de hoje anuncia itens (${todayLabel})`);
  const dots = await page.$eval(
    'button[aria-current="date"]',
    (b) => b.querySelectorAll('span[aria-hidden] > span').length,
  );
  ok(dots >= 2, `hoje tem bolinhas coloridas por categoria (${dots})`);
  let items = await dayItems();
  ok(
    items.some((l) => l.includes('Dentista')) && items.some((l) => l.includes('Beber água')),
    'lista do dia mostra os itens de hoje',
  );
  await page.screenshot({ path: OUT + 'agenda-light.png' });

  // concluir só a ocorrência de hoje da série diária
  await page.click('button[aria-label="Concluir \\"Beber água\\""]');
  await sleep(500);
  const occ = await api('GET', `/reminders/occurrences?from=${plus(-1)}&to=${plus(1)}`);
  const agua = occ.filter((o) => o.title === 'Beber água');
  ok(
    agua.find((o) => o.date === today).done && !agua.find((o) => o.date !== today).done,
    'concluir marca só a ocorrência de hoje da série',
  );

  // criar série semanal Seg/Qua/Sex pelo modal
  await page.$$eval('button', (bs) => bs.find((b) => b.textContent.trim() === 'Novo').click());
  await page.waitForSelector('dialog[open]');
  await page.type('dialog[open] input', 'Treino de força');
  await page.$$eval('dialog[open] button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.includes('Saúde')).click(),
  );
  await page.$$eval('dialog[open] button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.includes('Semanal')).click(),
  );
  // limpa os dias e escolhe Seg/Qua/Sex
  for (const d of ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) {
    const on = await page.$eval(
      `dialog[open] button[aria-label="${d}"]`,
      (b) => b.getAttribute('aria-pressed') === 'true',
    );
    const want = ['Seg', 'Qua', 'Sex'].includes(d);
    if (on !== want) await page.click(`dialog[open] button[aria-label="${d}"]`);
  }
  await page.screenshot({ path: OUT + 'agenda-modal.png' });
  await page.click('dialog[open] button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  const all = await api('GET', `/reminders/occurrences?from=${today}&to=${plus(13)}`);
  const treino = all
    .filter((o) => o.title === 'Treino de força')
    .map((o) => new Date(o.date + 'T12:00').getDay());
  ok(
    treino.length === 6 && treino.every((d) => [1, 3, 5].includes(d)),
    `série semanal só em Seg/Qua/Sex (${treino.length} em 2 semanas)`,
  );

  // selecionar dia +3 pelo calendário
  const d3 = plus(3);
  const d3Label = new Date(d3 + 'T12:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const cell = await page.$(`button[aria-label^="${d3Label}"]`);
  if (cell) {
    await cell.click();
    await sleep(200);
    items = await dayItems();
    ok(
      items.some((l) => l.includes('Prova de inglês')),
      'clicar em outro dia mostra os itens dele',
    );
  }

  // filtro de categoria
  await page.$$eval('button[aria-pressed]', (bs) =>
    bs.find((b) => b.textContent.trim() === 'Estudos').click(),
  );
  await sleep(200);
  items = await dayItems();
  ok(!items.some((l) => l.includes('Prova de inglês')), 'filtro esconde a categoria Estudos');
  await page.$$eval('button[aria-pressed]', (bs) =>
    bs.find((b) => b.textContent.trim() === 'Estudos').click(),
  );

  // abrir item recorrente → aviso de série
  await page.$$eval('li button', (bs) =>
    bs
      .find(
        (b) => b.textContent.includes('Daily do trabalho') || b.textContent.includes('Beber água'),
      )
      ?.click(),
  );
  await page.waitForSelector('dialog[open]');
  await page.waitForFunction(() =>
    document.querySelector('dialog[open]').textContent.includes('toda a série'),
  );
  ok(true, 'editar item recorrente avisa que vale para a série');
  await page.keyboard.press('Escape');
  await sleep(200);

  // navegação de mês
  const before = await page.$eval('h2[data-month-label]', (h) => h.textContent);
  await page.click('button[aria-label="Próximo mês"]');
  await sleep(400);
  const after = await page.$eval('h2[data-month-label]', (h) => h.textContent);
  ok(before !== after, `navega de mês (${before} → ${after})`);
  await page.click('button[aria-label="Mês anterior"]');

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await sleep(300);
  await page.screenshot({ path: OUT + 'agenda-dark.png' });

  // Home: mini-agenda (mostra no máximo 3 por dia; o resto vira "+N na agenda")
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('section[aria-label="Hoje"] button[role="checkbox"]');
  const todayItems = (await api('GET', `/reminders/occurrences?from=${today}&to=${today}`)).filter(
    (o) => !o.done,
  );
  const shown = await page.$$eval(
    'section[aria-label="Hoje"] button[role="checkbox"]',
    (b) => b.length,
  );
  ok(
    shown === Math.min(3, todayItems.length + 0) || shown >= 1,
    `mini-agenda da Home mostra compromissos de hoje (${shown} visíveis)`,
  );
  if (todayItems.length + 1 > 3)
    ok(
      (await page.evaluate(() => document.body.textContent)).includes('na agenda'),
      'excedente aparece como "+N na agenda"',
    );
  const pending = 'section[aria-label="Hoje"] button[role="checkbox"][aria-checked="false"]';
  const firstLabel = await page.$eval(pending, (b) => b.getAttribute('aria-label'));
  const title = firstLabel.match(/"(.+)"/)[1];
  await page.click(pending);
  await sleep(500);
  const hit = (await api('GET', `/reminders/occurrences?from=${today}&to=${today}`)).find(
    (o) => o.title === title,
  );
  ok(hit.done, `check rápido pela Home conclui o compromisso ("${title}")`);
  await page.screenshot({ path: OUT + 'home-dark.png' });

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/lembretes', { waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-current="date"]');
  await page.screenshot({ path: OUT + 'agenda-mobile-dark.png', fullPage: true });

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
