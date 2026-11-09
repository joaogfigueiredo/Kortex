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

for (const a of await api('GET', '/finance')) await api('DELETE', `/finance/${a.id}`);
const clt = await api('POST', '/finance', {
  title: 'Trabalho principal (CLT)',
  kind: 'job',
  status: 'active',
  actualMonthlyCents: 650000,
});
await api('POST', '/finance', {
  title: 'Freelas de landing page',
  kind: 'freelance',
  status: 'active',
  actualMonthlyCents: 180000,
  expectedMonthlyCents: 300000,
});
const yt = await api('POST', '/finance', {
  title: 'Canal de vídeos sobre produtividade',
  kind: 'content',
  status: 'idea',
  expectedMonthlyCents: 150000,
});
await api('POST', '/finance', {
  title: 'Template de Notion',
  kind: 'business',
  status: 'development',
  expectedMonthlyCents: 80000,
});
const yesterday = new Date(Date.now() - 864e5).toISOString();
await api('POST', `/finance/${clt.id}/entries`, {
  type: 'alert',
  content: 'Conferir holerite',
  dueAt: yesterday,
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
const byTitle = async (t) => (await api('GET', '/finance')).find((a) => a.title.startsWith(t));
const text = async () => (await page.evaluate(() => document.body.textContent)).replace(/\s/g, ' ');

try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(BASE + '/financas', { waitUntil: 'networkidle0' });
  await page.waitForSelector('article');

  const t = await text();
  ok(
    t.includes('R$ 8.300') && t.includes('Renda ativa'),
    'resumo soma renda ativa (6.500 + 1.800)',
  );
  ok(t.includes('1 com prazo vencido'), 'resumo aponta aviso vencido');
  ok(t.includes('venceu'), 'card mostra aviso vencido');
  await page.screenshot({ path: OUT + 'finance-light.png' });

  // arrastar "Canal" de Ideias -> Desenvolvimento
  const idx = await page.$$eval('article h3', (hs) =>
    hs.findIndex((h) => h.textContent.includes('Canal de vídeos')),
  );
  const from = await (await page.$$('article'))[idx].boundingBox();
  const to = await (await page.$('section[aria-label="Desenvolvimento"] > div')).boundingBox();
  await page.mouse.move(from.x + 30, from.y + 15);
  await page.mouse.down();
  for (let s = 1; s <= 20; s++) {
    await page.mouse.move(
      from.x + 30 + ((to.x + 60 - from.x - 30) * s) / 20,
      from.y + 15 + ((to.y + to.height - 30 - from.y - 15) * s) / 20,
    );
    await sleep(16);
  }
  await page.mouse.up();
  await sleep(700);
  ok((await byTitle('Canal')).status === 'development', 'arrastou para Desenvolvimento');
  const hist = await api('GET', `/finance/${yt.id}/entries`);
  ok(
    hist[0].content === 'Movida de Ideias para Desenvolvimento',
    'movimentação registrada no histórico',
  );

  // abrir modal, editar valor real BRL e salvar
  await page.$$eval('article h3', (hs) =>
    hs.find((h) => h.textContent.includes('Canal de vídeos')).click(),
  );
  await page.waitForSelector('dialog[open]');
  ok(
    await page.$eval('dialog[open]', (d) =>
      d.textContent.includes('Movida de Ideias para Desenvolvimento'),
    ),
    'timeline no modal mostra a movimentação',
  );

  // adicionar observação
  await page.type(
    'dialog[open] textarea[aria-label="Texto da observação"]',
    'Gravar 3 vídeos piloto',
  );
  // digita algo no nome ANTES do refetch, para provar que não é apagado
  const nameInput = (await page.$$('dialog[open] input'))[0];
  await nameInput.click({ clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await nameInput.type('Canal de vídeos (YouTube)');
  await page.$$eval('dialog[open] button', (bs) =>
    bs.find((b) => b.textContent === 'Adicionar').click(),
  );
  await page.waitForFunction(() =>
    document.querySelector('dialog[open]').textContent.includes('Gravar 3 vídeos piloto'),
  );
  ok(true, 'observação adicionada e exibida');
  ok(
    (await nameInput.evaluate((i) => i.value)) === 'Canal de vídeos (YouTube)',
    'refetch NÃO apagou edição em andamento',
  );

  // aviso com data
  await page.$$eval('dialog[open] button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.includes('Aviso')).click(),
  );
  await page.type('dialog[open] textarea[aria-label="Texto do aviso"]', 'Comprar microfone');
  await page.$eval('dialog[open] input[type="date"]', (el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, '2026-12-15');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.$$eval('dialog[open] button', (bs) =>
    bs.find((b) => b.textContent === 'Adicionar').click(),
  );
  await page.waitForFunction(() =>
    document.querySelector('dialog[open]').textContent.includes('Comprar microfone'),
  );
  let card = await byTitle('Canal');
  ok(
    card.openAlerts === 1 && card.nextDueAt.startsWith('2026-12-15'),
    'aviso com data salvo (card: 1 aviso)',
  );

  // valores em BRL
  const money = await page.$$('dialog[open] input[inputmode="decimal"]');
  await money[1].click({ clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await money[1].type('1.250,5');
  await page.screenshot({ path: OUT + 'finance-modal.png' });
  await page.click('dialog[open] button[type="submit"][form="finance-form"]');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  card = await byTitle('Canal');
  ok(card.actualMonthlyCents === 125050, '"1.250,5" salvo como 125050 centavos');
  ok(card.title === 'Canal de vídeos (YouTube)', 'nome editado salvo');
  const h2 = await api('GET', `/finance/${yt.id}/entries`);
  const edit = h2.find((e) => e.type === 'edit' && e.content.includes('Renda real'));
  ok(
    edit && edit.content.includes('R$ 1.250,50') && edit.content.includes('Título'),
    `diff legível no histórico: ${edit?.content.replace(/\n/g, ' | ')}`,
  );

  // resolver aviso vencido do CLT
  await page.$$eval('article h3', (hs) =>
    hs.find((h) => h.textContent.includes('Trabalho principal')).click(),
  );
  await page.waitForSelector('dialog[open]');
  await page.$$eval('dialog[open] button', (bs) =>
    bs.find((b) => b.textContent.includes('Marcar resolvido')).click(),
  );
  await page.waitForFunction(() =>
    document.querySelector('dialog[open]').textContent.includes('Resolvido'),
  );
  ok((await byTitle('Trabalho')).openAlerts === 0, 'aviso marcado como resolvido');
  await page.keyboard.press('Escape');
  await sleep(300);
  ok((await text()).includes('nenhum vencido'), 'resumo atualizado (nenhum vencido)');

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await sleep(300);
  await page.screenshot({ path: OUT + 'finance-dark.png' });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('article');
  await page.screenshot({ path: OUT + 'finance-mobile-dark.png' });
  await page.$$eval('article h3', (hs) => hs.find((h) => h.textContent.includes('Canal')).click());
  await page.waitForSelector('dialog[open]');
  await page.$$eval('dialog[open] button[role="radio"]', (bs) =>
    bs.find((b) => b.textContent.includes('Histórico e avisos')).click(),
  );
  await sleep(300);
  await page.screenshot({ path: OUT + 'finance-mobile-history.png' });

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
