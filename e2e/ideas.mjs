// E2E das Ideias: seed via API, arrastar com mouse, modal, promover, screenshots.
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
const assert = (cond, msg) => {
  if (!cond) throw new Error('FALHOU: ' + msg);
  console.log('✔', msg);
};

// --- seed limpo ---
for (const i of await api('GET', '/ideas')) await api('DELETE', `/ideas/${i.id}`);
const seed = [
  ['App de receitas por ingrediente', 'Filtrar receitas pelo que tem na geladeira', 'organized', 1],
  ['Canal sobre produtividade', 'Vídeos curtos semanais', 'organized', 2],
  ['Bot de finanças no Telegram', null, 'started', 2],
  ['Extensão de foco para o navegador', 'Bloqueia sites durante o Modo Foco', 'developing', 1],
  ['Template de Notion', 'Vendido na Gumroad', 'done', 3],
];
for (const [title, description, status, priority] of seed)
  await api('POST', '/ideas', { title, description, status, priority });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--blink-settings=preferredColorScheme=1'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/ideias', { waitUntil: 'networkidle0' });
  await page.waitForSelector('article');
  await page.screenshot({ path: OUT + 'ideas-light.png' });

  // --- arrastar "Canal sobre produtividade" para "Em desenvolvimento" ---
  const card = await page.$$eval('article h3', (hs) =>
    hs.findIndex((h) => h.textContent.includes('Canal sobre')),
  );
  const cards = await page.$$('article');
  const from = await cards[card].boundingBox();
  const target = await page.$('section[aria-label="Em desenvolvimento"] > div');
  const to = await target.boundingBox();
  await page.mouse.move(from.x + 40, from.y + 20);
  await page.mouse.down();
  for (let s = 1; s <= 20; s++) {
    await page.mouse.move(
      from.x + 40 + ((to.x + 60 - from.x - 40) * s) / 20,
      from.y + 20 + ((to.y + to.height - 30 - from.y - 20) * s) / 20,
    );
    await new Promise((r) => setTimeout(r, 16));
  }
  await page.screenshot({ path: OUT + 'ideas-dragging.png' });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 600));

  let all = await api('GET', '/ideas');
  const canal = all.find((i) => i.title.startsWith('Canal'));
  assert(canal.status === 'developing', 'card arrastado salvo em "developing"');
  const devCol = all.filter((i) => i.status === 'developing').map((i) => i.title);
  assert(devCol.at(-1).startsWith('Canal'), `soltou no fim da coluna (${devCol.join(' | ')})`);
  const uiDev = await page.$$eval('section[aria-label="Em desenvolvimento"] article h3', (h) =>
    h.map((x) => x.textContent),
  );
  assert(uiDev.length === 2, 'UI mostra 2 cards em "Em desenvolvimento"');

  // --- clicar abre modal de edição; promover a projeto ---
  await page.$$eval('article h3', (hs) =>
    hs.find((h) => h.textContent.includes('Bot de finanças')).click(),
  );
  await page.waitForSelector('dialog[open]');
  const title = await page.$eval('dialog[open] input', (i) => i.value);
  assert(title === 'Bot de finanças no Telegram', 'clique abre o modal com os dados');
  await page.screenshot({ path: OUT + 'ideas-modal.png' });
  await page.$$eval('dialog[open] button', (bs) =>
    bs.find((b) => b.textContent === 'Promover').click(),
  );
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  all = await api('GET', '/ideas');
  assert(all.find((i) => i.title.startsWith('Bot')).promotedProjectId, 'ideia promovida a projeto');
  await page.waitForFunction(() => document.body.innerText.includes('Ideia virou projeto'));
  assert(true, 'toast de sucesso exibido');

  // --- criar pelo "+" da coluna Finalizadas ---
  await page.click('button[aria-label="Adicionar em Finalizadas"]');
  await page.waitForSelector('dialog[open]');
  await page.type('dialog[open] input', 'Ideia criada no teste');
  await page.click('dialog[open] button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  all = await api('GET', '/ideas');
  const created = all.find((i) => i.title === 'Ideia criada no teste');
  assert(
    created?.status === 'done' && created.completedAt,
    'criada na coluna clicada (done) com completedAt',
  );

  // --- busca ---
  await page.type('input[type="search"]', 'notion');
  await new Promise((r) => setTimeout(r, 200));
  const visible = await page.$$eval('article', (a) => a.length);
  assert(visible === 1, 'busca filtra (sem acento/maiúscula)');
  await page.click('input[type="search"]', { clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');

  // --- dark + mobile ---
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.screenshot({ path: OUT + 'ideas-dark.png' });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('article');
  await page.screenshot({ path: OUT + 'ideas-mobile-dark.png' });

  assert(errors.length === 0, `sem erros no console (${errors.join(' / ')})`);
} finally {
  await browser.close();
}
