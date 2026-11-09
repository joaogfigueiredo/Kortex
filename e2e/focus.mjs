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

const subjects = await api('GET', `/studies?today=${TODAY}`);
const eng =
  subjects.find((s) => s.name === 'Inglês') ??
  (await api('POST', `/studies?today=${TODAY}`, { name: 'Inglês' }));
const focusEntries = async () =>
  (await api('GET', '/time?limit=500')).filter((e) => e.source === 'focus');
const before = (await focusEntries()).length;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--blink-settings=preferredColorScheme=1', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const text = async () => (await page.evaluate(() => document.body.textContent)).replace(/\s/g, ' ');

try {
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/ideias', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.removeItem('kortex-focus'));

  // ---------- Captura rápida ----------
  await page.keyboard.press('n');
  await page.waitForSelector('dialog[open] input[aria-label="Sua ideia"]');
  ok(true, 'atalho N abre a captura rápida');
  await page.type('dialog[open] input', 'App de flashcards com IA');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await sleep(400);
  const ideas = await api('GET', '/ideas');
  ok(
    ideas.some((i) => i.title === 'App de flashcards com IA' && i.status === 'organized'),
    'Enter salva a ideia em "Organizadas"',
  );
  ok(
    await page.$$eval('article h3', (h) =>
      h.some((x) => x.textContent === 'App de flashcards com IA'),
    ),
    'quadro de Ideias atualiza na hora',
  );

  await page.click('button[aria-label^="Captura rápida"]');
  await page.waitForSelector('dialog[open]');
  await page.$$eval('dialog[open] button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.includes('Lembrete')).click(),
  );
  await page.type('dialog[open] input[aria-label="Seu lembrete"]', 'dentista amanhã às 15h');
  await sleep(150);
  const chips = await page.$eval('dialog[open]', (d) => d.textContent);
  ok(
    chips.includes('Amanhã') && chips.includes('15:00') && chips.includes('“Dentista”'),
    'pré-visualiza data, hora e título interpretados',
  );
  await page.screenshot({ path: OUT + 'capture-reminder.png' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  const rems = await api('GET', '/reminders');
  ok(
    rems.some((r) => r.title === 'Dentista' && r.startAt === `${plus(1)}T15:00` && !r.allDay),
    'lembrete salvo: "Dentista", amanhã 15:00',
  );

  // atalho não dispara digitando em campo
  await page.click('input[type="search"]');
  await page.keyboard.press('n');
  await sleep(200);
  ok(!(await page.$('dialog[open]')), 'atalho N é ignorado dentro de campos de texto');
  await page.click('main h1');

  // ---------- Modo Foco: timer ----------
  await page.goto(BASE + '/estudos', { waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-label="Focar em Inglês"]');
  await sleep(300);
  await page.$eval('button[aria-label="Focar em Inglês"]', (b) => b.click());
  await page.waitForSelector('dialog[open] form#focus-form');
  ok(
    (await page.$eval(
      'dialog[open] select[aria-label="Matéria"]',
      (s) => s.selectedOptions[0].textContent,
    )) === 'Inglês',
    'botão Focar da matéria pré-seleciona Inglês',
  );
  const minutes = await page.$('dialog[open] input[aria-label="Minutos"]');
  await minutes.click({ clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await minutes.type('1');
  await page.$$eval('dialog[open] button[type="submit"]', (bs) =>
    bs.find((b) => b.textContent.includes('Começar')).click(),
  );
  await page.waitForSelector('[role="dialog"][aria-label="Modo Foco"]');
  await sleep(1300);
  let clock = await page.$eval(
    '[role="dialog"][aria-label="Modo Foco"] time',
    (t) => t.textContent,
  );
  ok(/^00:5\d$/.test(clock), `timer em contagem regressiva (${clock})`);
  ok((await text()).includes('Estudo · Inglês'), 'mostra no que está focando');
  ok(
    !(await page.$('button[aria-label^="Captura rápida"]')),
    'botão flutuante some durante o foco',
  );
  ok(
    (await page.title()).includes('· Foco'),
    `título da aba mostra o tempo (${await page.title()})`,
  );
  await page.screenshot({ path: OUT + 'focus-running.png' });

  // pausar com Espaço
  await page.keyboard.press('Space');
  await sleep(300);
  ok((await text()).includes('Pausado'), 'Espaço pausa');
  const pausedAt = await page.$eval(
    '[role="dialog"][aria-label="Modo Foco"] time',
    (t) => t.textContent,
  );
  await sleep(1200);
  ok(
    (await page.$eval('[role="dialog"][aria-label="Modo Foco"] time', (t) => t.textContent)) ===
      pausedAt,
    'pausado não avança',
  );
  await page.screenshot({ path: OUT + 'focus-paused.png' });
  await page.keyboard.press('Space');

  // simula que o tempo passou com a aba fechada: volta o início 61 s e recarrega
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kortex-focus'));
    s.resumedAt -= 61_000;
    localStorage.setItem('kortex-focus', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.textContent.includes('Sessão concluída'));
  ok(true, 'sessão sobrevive ao recarregar e detecta o fim do timer');
  ok(
    (await page.$eval('[role="dialog"][aria-label="Modo Foco"] time', (t) => t.textContent)) ===
      '1min',
    'tela de conclusão mostra 1min (limitado à meta)',
  );
  await page.screenshot({ path: OUT + 'focus-finished.png' });
  await page.$$eval('[role="dialog"][aria-label="Modo Foco"] button', (bs) =>
    bs.find((b) => b.textContent.includes('Salvar')).click(),
  );
  await page.waitForFunction(
    () => !document.querySelector('[role="dialog"][aria-label="Modo Foco"]'),
  );
  const after = await focusEntries();
  const last = after[0];
  ok(
    after.length === before + 1 &&
      last.module === 'study' &&
      last.refId === eng.id &&
      last.durationSec === 60,
    'sessão salva: estudo/Inglês, 60 s, origem "focus"',
  );
  ok(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(last.startedAt),
    `horário local flutuante (${last.startedAt})`,
  );
  await sleep(400);
  ok(
    (await text()).includes('Última: agora') || (await text()).includes('agora'),
    'Estudos atualiza a última sessão',
  );

  // ---------- Cronômetro curto → não registra ----------
  await page.keyboard.press('f');
  await page.waitForSelector('dialog[open] form#focus-form');
  await page.$$eval('dialog[open] button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.includes('Trabalho')).click(),
  );
  await page.$$eval('dialog[open] button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.includes('Cronômetro')).click(),
  );
  await page.$$eval('dialog[open] button[type="submit"]', (bs) =>
    bs.find((b) => b.textContent.includes('Começar')).click(),
  );
  await page.waitForSelector('[role="dialog"][aria-label="Modo Foco"]');
  await sleep(2200);
  clock = await page.$eval('[role="dialog"][aria-label="Modo Foco"] time', (t) => t.textContent);
  ok(/^00:0[12]$/.test(clock), `cronômetro conta para cima (${clock})`);
  // descartar exige 2 toques
  await page.click('button[aria-label="Descartar sessão"]');
  ok(await page.$('[role="dialog"][aria-label="Modo Foco"]'), '1º toque no ✕ só pede confirmação');
  await page.click('button[aria-label="Confirmar: descartar sessão"]');
  await page.waitForFunction(
    () => !document.querySelector('[role="dialog"][aria-label="Modo Foco"]'),
  );
  ok((await focusEntries()).length === before + 1, 'descartar não registra nada');

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: OUT + 'fab-mobile.png' });
  ok(
    (await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
    )) <= 0,
    'sem rolagem horizontal com o botão flutuante',
  );

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
