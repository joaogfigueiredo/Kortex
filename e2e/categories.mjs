import puppeteer from 'puppeteer-core';
import { CHROME, OUT } from './lib.mjs';

const BASE = 'http://localhost:5199';
{
  const h = await (await fetch(BASE + '/api/health')).json().catch(() => ({}));
  if (h.db !== 'test.db') {
    console.error('ABORTADO: servidor não está usando test.db (db=' + h.db + ')');
    process.exit(3);
  }
}
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
const cats = () => api('GET', '/reminders/categories');

// estado conhecido
for (const c of await cats())
  if (['Faculdade', 'Estudos Avançados'].includes(c.name))
    await api('DELETE', `/reminders/categories/${c.id}`);

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
  (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
);
const text = async () => (await page.evaluate(() => document.body.textContent)).replace(/\s/g, ' ');
const card = 'section, div'; // o cartão é achado pelo título
const clickIn = (t) =>
  page.$$eval(
    'button',
    (bs, t) => {
      const b = bs.find((x) => x.textContent.trim() === t);
      if (!b) throw new Error('botão ' + t);
      b.click();
    },
    t,
  );

try {
  await page.setViewport({ width: 1280, height: 1400 });
  await page.goto(BASE + '/configuracoes', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.textContent.includes('Categorias da agenda'));
  const base = (await cats()).length;
  ok(
    (await text()).includes('Trabalho') && (await text()).includes('Urgente'),
    `lista as ${base} categorias existentes`,
  );
  ok(
    !(await text()).includes('Sistema visual'),
    'o cartão de demonstração "Sistema visual" saiu das Configurações',
  );

  // criar
  await clickIn('Nova categoria');
  await page.type('input[placeholder^="Ex.: Faculdade"]', 'Faculdade');
  await page.click('button[aria-label="Cor #FF9F5A"]');
  ok(
    await page.$eval(
      'button[aria-label="Cor #FF9F5A"]',
      (b) => b.getAttribute('aria-checked') === 'true',
    ),
    'cor escolhida fica marcada (radio)',
  );
  await page.screenshot({ path: OUT + 'categories-form.png' });
  await clickIn('Criar categoria');
  await page.waitForFunction(() => document.body.textContent.includes('Categoria criada'));
  let list = await cats();
  const fac = list.find((c) => c.name === 'Faculdade');
  ok(fac && fac.color.toUpperCase() === '#FF9F5A', 'categoria criada com a cor escolhida');

  // nome duplicado (sem diferenciar maiúsculas) é recusado
  await clickIn('Nova categoria');
  await page.type('input[placeholder^="Ex.: Faculdade"]', 'faculdade');
  await clickIn('Criar categoria');
  await page.waitForFunction(() => document.body.textContent.includes('Já existe uma categoria'));
  ok((await cats()).length === base + 1, 'nome repetido é recusado com mensagem clara');
  await clickIn('Cancelar');

  // aparece como filtro na Agenda e no formulário de novo lembrete
  await page.goto(BASE + '/lembretes', { waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-pressed]');
  ok(
    await page.$$eval('button[aria-pressed]', (bs) =>
      bs.some((b) => b.textContent.trim() === 'Faculdade'),
    ),
    'a nova categoria vira filtro na Agenda',
  );

  // editar nome e cor
  await page.goto(BASE + '/configuracoes', { waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-label="Editar Faculdade"]');
  await page.click('button[aria-label="Editar Faculdade"]');
  const input = await page.$('input[placeholder^="Ex.: Faculdade"]');
  await input.click({ clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await input.type('Estudos Avançados');
  await page.click('button[aria-label="Cor #B79CFF"]');
  await clickIn('Salvar');
  await page.waitForFunction(() => document.body.textContent.includes('Categoria atualizada'));
  list = await cats();
  const edited = list.find((c) => c.id === fac.id);
  ok(
    edited.name === 'Estudos Avançados' && edited.color.toUpperCase() === '#B79CFF',
    'edição de nome e cor salva',
  );

  // um lembrete nessa categoria; excluir a categoria deixa o lembrete sem cor
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const d = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const rem = await api('POST', '/reminders', {
    title: 'Prova de cálculo',
    startAt: `${d}T08:00`,
    categoryId: fac.id,
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-label="Excluir Estudos Avançados"]');
  await page.click('button[aria-label="Excluir Estudos Avançados"]');
  ok(
    await page.$('button[aria-label="Confirmar exclusão de Estudos Avançados"]'),
    '1º clique em excluir só pede confirmação',
  );
  ok(
    (await cats()).some((c) => c.id === fac.id),
    'ainda existe antes de confirmar',
  );
  await page.click('button[aria-label="Confirmar exclusão de Estudos Avançados"]');
  await page.waitForFunction(() => document.body.textContent.includes('Categoria excluída'));
  ok(!(await cats()).some((c) => c.id === fac.id), 'categoria excluída');
  const occ = (await api('GET', `/reminders/occurrences?from=${d}&to=${d}`)).find(
    (o) => o.reminderId === rem.id,
  );
  ok(occ && occ.categoryId === null, 'o lembrete continua existindo, só ficou sem categoria');
  await api('DELETE', `/reminders/${rem.id}`);

  // celular
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-label="Editar Trabalho"]');
  ok(
    (await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
    )) <= 0,
    'sem rolagem lateral no celular',
  );

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
