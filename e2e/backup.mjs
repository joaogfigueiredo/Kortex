import puppeteer from 'puppeteer-core';
import { CHROME, OUT } from './lib.mjs';
import fs from 'node:fs';

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

// estado conhecido: uma ideia "Antes" → exporta → cria "Depois"
for (const i of await api('GET', '/ideas')) await api('DELETE', `/ideas/${i.id}`);
for (const b of await api('GET', '/backups')) await api('DELETE', `/backups/${b.name}`);
await api('POST', '/ideas', { title: 'Ideia ANTES do backup' });
const snapshot = await api('GET', '/export?format=json');
const file = OUT + 'kortex-backup-teste.json';
fs.writeFileSync(file, JSON.stringify(snapshot));
await api('POST', '/ideas', { title: 'Ideia DEPOIS do backup' });
fs.writeFileSync(OUT + 'nao-e-backup.json', JSON.stringify({ hello: 'world' }));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--blink-settings=preferredColorScheme=1'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on(
  'console',
  (m) => m.type() === 'error' && !m.text().includes('400') && errors.push(m.text()),
);
const text = async () => (await page.evaluate(() => document.body.textContent)).replace(/\s/g, ' ');

try {
  await page.setViewport({ width: 1440, height: 1300 });
  await page.goto(BASE + '/configuracoes', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[aria-label="Backups"]');
  ok((await text()).includes('Nenhum backup ainda'), 'lista começa vazia');

  // backup agora
  await page.$$eval('button', (bs) =>
    bs.find((b) => b.textContent.includes('Fazer backup agora')).click(),
  );
  await page.waitForFunction(() => document.querySelector('[aria-label="Backups"] li'));
  ok((await api('GET', '/backups')).length === 1, 'backup manual criado e listado');
  ok((await text()).includes('Manual'), 'tipo "Manual" exibido');

  // downloads (os links funcionam e entregam o conteúdo certo)
  const links = await page.$$eval('a[download]', (as) => as.map((a) => a.getAttribute('href')));
  const json = await page.evaluate(
    async (h) => (await fetch(h)).json(),
    links.find((h) => h.includes('format=json')),
  );
  ok(
    json.format === 'kortex-backup' && json.tables.ideas.length === 2,
    'link "JSON" baixa o backup completo',
  );
  const zipHead = await page.evaluate(
    async (h) => [...new Uint8Array(await (await fetch(h)).arrayBuffer()).slice(0, 2)],
    links.find((h) => h.includes('format=csv')),
  );
  ok(zipHead[0] === 0x50 && zipHead[1] === 0x4b, 'link "CSV" baixa um .zip válido (PK)');
  const dbHead = await page.evaluate(
    async (h) =>
      new TextDecoder().decode(new Uint8Array(await (await fetch(h)).arrayBuffer()).slice(0, 15)),
    links.find((h) => h.includes('/api/backups/')),
  );
  ok(dbHead === 'SQLite format 3', 'download do backup .db é um SQLite válido');

  // arquivo inválido
  await (await page.$('#restore-file')).uploadFile(OUT + 'nao-e-backup.json');
  await page.waitForFunction(() => document.body.textContent.includes('Arquivo inválido'));
  ok(!(await page.$('dialog[open]')), 'arquivo que não é backup é recusado sem abrir confirmação');

  // restaurar
  await (await page.$('#restore-file')).uploadFile(file);
  await page.waitForSelector('dialog[open]');
  const modal = await page.$eval('dialog[open]', (d) => d.textContent);
  ok(
    modal.includes('kortex-backup-teste.json') && modal.includes('ideas'),
    'confirmação mostra o arquivo e o que contém',
  );
  await page.screenshot({ path: OUT + 'backup-confirm.png' });
  await page.$$eval('dialog[open] button', (bs) =>
    bs.find((b) => b.textContent.includes('Substituir')).click(),
  );
  await page.waitForFunction(() => document.body.textContent.includes('Dados restaurados'));
  const ideas = (await api('GET', '/ideas')).map((i) => i.title);
  ok(
    ideas.length === 1 && ideas[0] === 'Ideia ANTES do backup',
    'dados voltaram ao estado do backup',
  );
  await sleep(400);
  ok((await text()).includes('Antes de restaurar'), 'cópia de segurança aparece na lista');
  ok(
    (await api('GET', '/backups')).some((b) => b.name.startsWith('kortex-pre-import-')),
    'cópia de segurança existe no servidor',
  );
  await page.screenshot({ path: OUT + 'backup-light.png', fullPage: true });

  // excluir com confirmação
  const firstDel = await page.$('[aria-label="Backups"] button[aria-label^="Excluir"]');
  await firstDel.click();
  ok(
    await page.$('[aria-label="Backups"] button[aria-label^="Confirmar exclusão"]'),
    '1º clique pede confirmação',
  );
  const before = (await api('GET', '/backups')).length;
  await page.click('[aria-label="Backups"] button[aria-label^="Confirmar exclusão"]');
  await sleep(500);
  ok((await api('GET', '/backups')).length === before - 1, 'excluído após confirmar');

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await sleep(300);
  await page.screenshot({ path: OUT + 'backup-dark.png', fullPage: true });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[aria-label="Backups"]');
  const o = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
  );
  ok(o <= 0, `celular sem rolagem horizontal (${o}px)`);

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
