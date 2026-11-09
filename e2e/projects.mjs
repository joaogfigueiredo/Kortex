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

for (const p of await api('GET', '/projects')) await api('DELETE', `/projects/${p.id}`);
const seed = [
  { title: 'Portfólio pessoal', description: 'Site com meus projetos', status: 'idea' },
  { title: 'API de cotações', status: 'started' },
  {
    title: 'Kortex',
    description: 'Sistema de produtividade',
    status: 'development',
    devLevel: 1,
    repoUrl: 'https://github.com/joaogfigueiredo/Kortex',
  },
  { title: 'Bot do Discord', status: 'development', devLevel: 3 },
  { title: 'Landing page freelas', status: 'done' },
  {
    title: 'Blog técnico',
    description: 'Next.js + MDX',
    status: 'deployed',
    deployUrl: 'https://example.com',
    repoUrl: 'https://github.com/x/blog',
  },
];
for (const s of seed) await api('POST', '/projects', s);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--blink-settings=preferredColorScheme=1'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

async function drag(cardText, targetSelector) {
  const idx = await page.$$eval(
    'article h3',
    (hs, t) => hs.findIndex((h) => h.textContent.includes(t)),
    cardText,
  );
  const card = (await page.$$('article'))[idx];
  await card.scrollIntoView();
  const from = await card.boundingBox();
  const target = await page.$(targetSelector);
  const to = await target.boundingBox();
  await page.mouse.move(from.x + 30, from.y + 15);
  await page.mouse.down();
  const tx = to.x + Math.min(60, to.width / 2),
    ty = to.y + to.height - 30;
  for (let s = 1; s <= 25; s++) {
    await page.mouse.move(
      from.x + 30 + ((tx - from.x - 30) * s) / 25,
      from.y + 15 + ((ty - from.y - 15) * s) / 25,
    );
    await sleep(16);
  }
  await page.mouse.up();
  await sleep(700);
}
const byTitle = async (t) => (await api('GET', '/projects')).find((p) => p.title.startsWith(t));

try {
  await page.setViewport({ width: 1600, height: 900 });
  await page.goto(BASE + '/projetos', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.removeItem('kortex-board:projects:collapsed'));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('article');
  await page.screenshot({ path: OUT + 'projects-light.png' });

  // 1) Ideias -> Nível 2
  await drag('Portfólio', 'section[aria-label="Nível 2"] > div');
  let p = await byTitle('Portfólio');
  ok(p.status === 'development' && p.devLevel === 2, 'arrastou para Desenvolvimento · Nível 2');
  ok(!!p.startedAt, 'startedAt preenchido automaticamente');

  // 2) Kortex (Nível 1) -> Deployzado
  await drag('Kortex', 'section[aria-label="Deployzado"] > div');
  p = await byTitle('Kortex');
  ok(
    p.status === 'deployed' && p.devLevel === null && p.finishedAt && p.deployedAt,
    'deploy preenche concluído + deploy e zera nível',
  );

  // 3) recolher grupo e soltar no resumo -> Nível 1
  await page.click('button[aria-label="Recolher Desenvolvimento"]');
  await sleep(200);
  ok(!(await page.$('section[aria-label="Nível 2"]')), 'grupo recolhido esconde os níveis');
  const stored = await page.evaluate(() => localStorage.getItem('kortex-board:projects:collapsed'));
  ok(stored === '["development"]', 'estado recolhido salvo no navegador');
  await page.screenshot({ path: OUT + 'projects-collapsed.png' });
  await drag('API de cotações', 'section[aria-label="Desenvolvimento"] > div > div');
  p = await byTitle('API de cotações');
  ok(
    p.status === 'development' && p.devLevel === 1,
    'soltar no grupo recolhido envia para Nível 1',
  );
  await page.click('button[aria-label="Expandir Desenvolvimento"]');
  await sleep(200);

  // 4) modal: editar links (normaliza https://) e ver linha do tempo
  await page.$$eval('article h3', (hs) =>
    hs.find((h) => h.textContent.includes('Bot do Discord')).click(),
  );
  await page.waitForSelector('dialog[open]');
  ok(
    await page.$eval('dialog[open]', (d) => d.textContent.includes('Linha do tempo')),
    'modal mostra a linha do tempo',
  );
  const inputs = await page.$$('dialog[open] input');
  await inputs[1].type('github.com/joao/bot');
  await page.select('dialog[open] select', 'done');
  await page.screenshot({ path: OUT + 'projects-modal.png' });
  await page.click('dialog[open] button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  p = await byTitle('Bot do Discord');
  ok(p.repoUrl === 'https://github.com/joao/bot', 'URL sem protocolo vira https://');
  ok(
    p.status === 'done' && p.finishedAt && p.devLevel === null,
    'mudar etapa pelo modal ajusta status/datas',
  );

  // 5) link do card não abre o modal
  const before = (await browser.pages()).length;
  await page.click('a[aria-label="Abrir repositório"]');
  await sleep(500);
  ok(!(await page.$('dialog[open]')), 'clicar no link do card não abre o modal');
  for (const pg of (await browser.pages()).slice(before)) await pg.close();

  // 6) criar via "+" do Nível 3
  await page.click('button[aria-label="Adicionar em Nível 3"]');
  await page.waitForSelector('dialog[open]');
  ok(
    (await page.$eval('dialog[open] select', (s) => s.value)) === 'development:3',
    'modal já vem com Nível 3',
  );
  await page.type('dialog[open] input', 'Projeto teste N3');
  await page.click('dialog[open] button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  p = await byTitle('Projeto teste N3');
  ok(p.status === 'development' && p.devLevel === 3, 'criado direto no Nível 3');

  // screenshots
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await sleep(300);
  await page.screenshot({ path: OUT + 'projects-dark.png' });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('article');
  await page.screenshot({ path: OUT + 'projects-mobile-dark.png' });

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
