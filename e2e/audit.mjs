// Auditoria de acessibilidade (axe-core) em todas as páginas e estados interativos.
import puppeteer from 'puppeteer-core';
import { CHROME } from './lib.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const BASE = 'http://localhost:5199';
{
  const h = await (await fetch(BASE + '/api/health')).json().catch(() => ({}));
  if (h.db !== 'test.db') {
    console.error('ABORTADO: servidor não está usando test.db (db=' + h.db + ')');
    process.exit(3);
  }
}
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const PAGES = [
  '/',
  '/ideias',
  '/projetos',
  '/financas',
  '/lembretes',
  '/estudos',
  '/saude',
  '/dashboard',
  '/configuracoes',
];
const VIEWS = [
  { name: 'desktop-claro', w: 1280, h: 900, dark: false },
  { name: 'desktop-escuro', w: 1280, h: 900, dark: true },
  { name: 'celular-claro', w: 390, h: 844, dark: false, mobile: true },
  { name: 'celular-escuro', w: 390, h: 844, dark: true, mobile: true },
];

const click = (sel, text) => async (p) => {
  const hit = await p.$$eval(
    sel,
    (els, t) => {
      const e = els.find(
        (x) => !t || x.textContent.includes(t) || x.getAttribute('aria-label')?.includes(t),
      );
      if (e) e.click();
      return !!e;
    },
    text,
  );
  if (!hit) throw new Error('não achei ' + sel + ' ' + (text ?? ''));
  await sleep(500);
};
const STATES = [
  { name: 'Ideias: modal da ideia', path: '/ideias', setup: click('article h3') },
  { name: 'Projetos: modal do projeto', path: '/projetos', setup: click('article h3') },
  { name: 'Finanças: modal com histórico', path: '/financas', setup: click('article h3') },
  { name: 'Agenda: novo lembrete', path: '/lembretes', setup: click('button', 'Novo') },
  {
    name: 'Agenda: editar item',
    path: '/lembretes',
    setup: click('li button:not([role="checkbox"])'),
  },
  { name: 'Estudos: modal da matéria', path: '/estudos', setup: click('article > button') },
  { name: 'Estudos: registrar sessão', path: '/estudos', setup: click('button', 'Sessão') },
  { name: 'Saúde: plano de refeições', path: '/saude', setup: click('button', 'Plano') },
  {
    name: 'Início: gerenciar metas',
    path: '/',
    setup: click('button[aria-label="Gerenciar metas"]'),
  },
  {
    name: 'Captura rápida (N)',
    path: '/ideias',
    setup: async (p) => {
      await p.keyboard.press('n');
      await sleep(500);
    },
  },
  {
    name: 'Modo Foco: configuração (F)',
    path: '/estudos',
    setup: async (p) => {
      await p.keyboard.press('f');
      await sleep(500);
    },
  },
  { name: 'Configurações: criar PIN', path: '/configuracoes', setup: click('button', 'Criar PIN') },
  {
    name: 'Configurações: nova categoria',
    path: '/configuracoes',
    setup: click('button', 'Nova categoria'),
  },
  {
    name: 'Configurações: editar categoria',
    path: '/configuracoes',
    setup: click('button[aria-label^="Editar"]'),
  },
  { name: 'Modo "Mais" (celular)', path: '/', mobile: true, setup: click('button', 'Mais') },
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const found = new Map(); // regra → { impact, help, helpUrl, items: Map(chave → {scenarios:Set, html}) }
let runs = 0;

async function audit(page, scenario) {
  await page.evaluate(AXE);
  const res = await page.evaluate(
    (tags) =>
      axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }),
    TAGS,
  );
  runs++;
  for (const v of res.violations) {
    const rule = found.get(v.id) ?? {
      impact: v.impact,
      help: v.help,
      url: v.helpUrl,
      items: new Map(),
    };
    found.set(v.id, rule);
    for (const n of v.nodes) {
      const key = n.target.join(' ');
      const it = rule.items.get(key) ?? {
        scenarios: new Set(),
        html: n.html.slice(0, 110),
        why: (n.any[0] ?? n.all[0] ?? n.none[0])?.message?.slice(0, 160),
      };
      it.scenarios.add(scenario);
      rule.items.set(key, it);
    }
  }
}

try {
  for (const v of VIEWS) {
    const page = await browser.newPage();
    await page.setViewport({ width: v.w, height: v.h, isMobile: !!v.mobile, hasTouch: !!v.mobile });
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: v.dark ? 'dark' : 'light' },
    ]);
    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: 'networkidle0' });
      await page.waitForSelector('main');
      await sleep(400);
      await audit(page, `${path} · ${v.name}`);
    }
    await page.close();
  }
  // estados interativos: desktop claro, desktop escuro e celular escuro
  for (const v of [VIEWS[0], VIEWS[1], VIEWS[3]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: v.w, height: v.h, isMobile: !!v.mobile, hasTouch: !!v.mobile });
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: v.dark ? 'dark' : 'light' },
    ]);
    for (const s of STATES) {
      if (s.mobile && !v.mobile) continue;
      try {
        await page.goto(BASE + s.path, { waitUntil: 'networkidle0' });
        await page.waitForSelector('main');
        await sleep(300);
        await s.setup(page);
        await audit(page, `${s.name} · ${v.name}`);
      } catch (e) {
        console.log(`(pulado) ${s.name} · ${v.name}: ${e.message.split('\n')[0]}`);
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(
  `\n${runs} varreduras (axe-core ${JSON.parse(fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/package.json'), 'utf8')).version}, regras WCAG 2.2 AA + boas práticas)\n`,
);
if (!found.size) console.log('✔ NENHUMA violação encontrada.');
for (const [id, r] of [...found].sort(
  (a, b) =>
    ['critical', 'serious', 'moderate', 'minor'].indexOf(a[1].impact) -
    ['critical', 'serious', 'moderate', 'minor'].indexOf(b[1].impact),
)) {
  console.log(`✘ [${r.impact}] ${id}: ${r.help}  (${r.items.size} elemento(s))`);
  for (const [target, it] of [...r.items].slice(0, 14)) {
    console.log(
      `    alvo: ${target}\n    html: ${it.html}\n    por quê: ${it.why}\n    visto em: ${[...it.scenarios].slice(0, 3).join(' | ')}${it.scenarios.size > 3 ? ` (+${it.scenarios.size - 3})` : ''}`,
    );
  }
}
process.exit(found.size ? 1 : 0);
