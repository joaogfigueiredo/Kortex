import puppeteer from 'puppeteer-core';
import { CHROME } from './lib.mjs';

const BASE = 'http://localhost:5199';
{
  const h = await (await fetch(BASE + '/api/health')).json().catch(() => ({}));
  if (h.db !== 'test.db') {
    console.error('ABORTADO: servidor não está usando test.db (db=' + h.db + ')');
    process.exit(3);
  }
}
const ok = (c, m) => {
  if (!c) throw new Error('FALHOU: ' + m);
  console.log('✔', m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const active = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a
      ? `${a.tagName}|${a.id}|${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40)}`
      : '';
  });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on(
  'console',
  (m) =>
    m.type() === 'error' &&
    !/Failed to load resource|dynamically imported|Erro na interface|ERR_FAILED/.test(m.text()) &&
    errors.push(m.text()),
);

try {
  await page.setViewport({ width: 1280, height: 900 });

  // ── Link "Pular para o conteúdo" ──
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.keyboard.press('Tab');
  ok(
    (await active(page)).includes('Pular para o conteúdo'),
    'o 1º Tab cai no link "Pular para o conteúdo"',
  );
  ok(
    await page.$eval('a[href="#conteudo"]', (a) => {
      const r = a.getBoundingClientRect();
      return r.width > 40 && r.height > 20;
    }),
    'o link fica visível ao receber foco',
  );
  await page.keyboard.press('Enter');
  ok(
    (await active(page)).startsWith('MAIN|conteudo'),
    'Enter leva o foco para o conteúdo principal',
  );
  ok(!(await page.evaluate(() => location.hash)), 'sem poluir a URL com #conteudo');

  // ── Título por página + foco ao navegar ──
  const titles = {};
  for (const [label, path] of [
    ['Ideias', '/ideias'],
    ['Agenda', '/lembretes'],
    ['Saúde', '/saude'],
    ['Dashboard', '/dashboard'],
    ['Configurações', '/configuracoes'],
  ]) {
    await page.$$eval(
      'aside nav a',
      (as, l) => as.find((a) => a.textContent.trim() === l).click(),
      label,
    );
    await page.waitForFunction((p) => location.pathname === p, {}, path);
    await sleep(200);
    titles[label] = await page.title();
  }
  ok(
    Object.entries(titles).every(([l, t]) => t === `${l} · Kortex`),
    `cada página tem seu título (${JSON.stringify(titles)})`,
  );
  ok(
    (await active(page)).startsWith('MAIN|conteudo'),
    'ao navegar o foco vai para o conteúdo (leitor de tela anuncia a página nova)',
  );
  await page.$$eval('aside nav a', (as) =>
    as.find((a) => a.textContent.trim() === 'Início').click(),
  );
  await sleep(200);
  ok((await page.title()) === 'Kortex', 'início volta ao título "Kortex"');

  // ── Modal: foco entra, Esc fecha e o foco volta ao botão de origem ──
  await page.goto(BASE + '/ideias', { waitUntil: 'networkidle0' });
  await page.focus('button[aria-label="Adicionar em Organizadas e arquitetadas"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog[open]');
  ok(
    await page.evaluate(() =>
      document.querySelector('dialog[open]').contains(document.activeElement),
    ),
    'modal aberto: o foco está dentro dele',
  );
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  ok(
    (await active(page)).includes('Adicionar em Organizadas'),
    'Esc fecha o modal e o foco volta ao botão que o abriu',
  );

  // ── Card do kanban: teclado abre os detalhes; links internos continuam focáveis ──
  await page.goto(BASE + '/projetos', { waitUntil: 'networkidle0' });
  await page.waitForSelector('article');
  const roles = await page.$$eval('article', (as) => [
    ...new Set(as.map((a) => a.parentElement.getAttribute('role'))),
  ]);
  ok(
    roles.length === 1 && roles[0] === 'group',
    'cards do kanban são "group" (não mais "button" com links dentro)',
  );
  const desc = await page.$eval('article', (a) =>
    a.parentElement.getAttribute('aria-roledescription'),
  );
  ok(desc === 'card arrastável', `descrição em português para leitores de tela ("${desc}")`);
  const instr = await page.$eval('[id^="DndDescribedBy"]', (e) => e.textContent);
  ok(
    instr.includes('Enter abre os detalhes') && instr.includes('Espaço'),
    'instruções de teclado em português',
  );
  await page.$$eval('article', (as) => as[0].parentElement.focus());
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog[open]');
  ok(true, 'Enter no card abre os detalhes');
  await page.keyboard.press('Escape');

  // ── Gráficos não criam dezenas de paradas de Tab ──
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle0' });
  await page.$$eval('button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.trim() === '30 dias').click(),
  );
  await sleep(600);
  const tabStopsInCharts = await page.$$eval(
    'figure [tabindex]',
    (els) => els.filter((e) => e.getAttribute('tabindex') !== '-1').length,
  );
  ok(
    tabStopsInCharts === 0,
    `gráficos de 30 dias sem paradas de Tab inúteis (${tabStopsInCharts})`,
  );
  ok(
    (await page.$$eval('figure table', (t) => t.length)) >= 5,
    'os dados continuam disponíveis em tabelas para leitores de tela',
  );

  // ── Reflow: sem rolagem lateral a 320px (WCAG 1.4.10) em todas as páginas ──
  await page.setViewport({ width: 320, height: 640, isMobile: true, hasTouch: true });
  const bad = [];
  for (const p of [
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
    await page.goto(BASE + p, { waitUntil: 'networkidle0' });
    await page.waitForSelector('main');
    await sleep(250);
    const over = await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 320,
    );
    if (over > 0) bad.push(`${p} (+${over}px)`);
  }
  ok(bad.length === 0, `9 páginas a 320px sem rolagem lateral ${bad.join(', ')}`);

  // ── Movimento reduzido ──
  await page.setViewport({ width: 1280, height: 900 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  const dur = await page.evaluate(
    () => getComputedStyle(document.querySelector('aside nav a')).transitionDuration,
  );
  ok(parseFloat(dur) <= 0.001, `prefers-reduced-motion zera as transições (${dur})`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  // ── Recuperação de erro: o código de uma página falha ao baixar (aba antiga após atualização) ──
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.setRequestInterception(true);
  page.on('request', (r) => (/IdeasPage/.test(r.url()) ? r.abort() : r.continue()));
  await page.$$eval('aside nav a', (as) =>
    as.find((a) => a.textContent.trim() === 'Ideias').click(),
  );
  await page.waitForSelector('[role="alert"]', { timeout: 10000 });
  const alertText = await page.$eval('[role="alert"]', (e) => e.textContent);
  ok(
    alertText.includes('O Kortex foi atualizado') && alertText.includes('Recarregar'),
    'página que falha ao carregar mostra "O Kortex foi atualizado" + botão Recarregar (nada de tela branca)',
  );
  ok(!!(await page.$('aside nav')), 'o menu continua funcionando durante o erro');
  await page.$$eval('aside nav a', (as) =>
    as.find((a) => a.textContent.trim() === 'Agenda').click(),
  );
  await page.waitForSelector('button[aria-current="date"]');
  ok(!(await page.$('[role="alert"]')), 'trocar de página limpa o erro automaticamente');
  await page.setRequestInterception(false);

  ok(errors.length === 0, `sem erros inesperados no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
