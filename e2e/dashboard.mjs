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
const d0 = new Date();
const TODAY = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`;
const ok = (c, m) => {
  if (!c) throw new Error('FALHOU: ' + m);
  console.log('✔', m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dash = async (range) =>
  (await fetch(`${BASE}/api/dashboard?today=${TODAY}&range=${range}`)).json();
const fmtDur = (sec) => {
  if (sec <= 0) return '0min';
  const tm = Math.round(sec / 60),
    h = Math.floor(tm / 60),
    m = tm % 60;
  return !h ? `${m}min` : m ? `${h}h ${m}min` : `${h}h`;
};

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
const pick = async (label) => {
  await page.$$eval(
    'button[role="radio"]',
    (bs, l) => bs.find((b) => b.textContent.trim() === l).click(),
    label,
  );
  await sleep(700);
};

try {
  await page.setViewport({ width: 1440, height: 1600 });
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle0' });
  await page.waitForSelector('figure');

  // semana
  let api = await dash('week');
  let t = await text();
  ok(
    t.includes(fmtDur(api.kpis.focusSec)),
    `KPI tempo registrado bate com a API (${fmtDur(api.kpis.focusSec)})`,
  );
  ok(
    t.includes(fmtDur(api.kpis.studySec)),
    `KPI estudo bate com a API (${fmtDur(api.kpis.studySec)})`,
  );
  ok(t.includes('vs 7 dias anteriores'), 'mostra comparação com o período anterior');
  ok(
    (await page.$$eval('figure table', (ts) => ts.length)) >= 5,
    'cada gráfico tem tabela equivalente (leitor de tela)',
  );
  const legend = await page.$eval('figure figcaption', (f) => f.textContent);
  ok(
    legend.includes('Estudo') && legend.includes('Trabalho'),
    `legenda das áreas presente (${legend})`,
  );
  await page.screenshot({ path: OUT + 'dash-week-light.png', fullPage: true });

  // tooltip com detalhamento na barra de hoje
  const cols = await page.$$('figure div.flex-1.items-end');
  await cols[6].hover();
  await sleep(200);
  const tip = await page.evaluate(() =>
    [...document.querySelectorAll('figure .shadow-neu-sm')].map((x) => x.textContent).join(' | '),
  );
  ok(tip.includes('Total'), `tooltip mostra detalhamento e total (${tip.slice(0, 80)}…)`);

  // mês
  await pick('30 dias');
  api = await dash('month');
  t = await text();
  ok(t.includes(fmtDur(api.kpis.focusSec)), `30 dias: KPI bate (${fmtDur(api.kpis.focusSec)})`);
  ok((await page.$$('figure [title*=":"]')).length === 30, 'mapa de constância com 30 dias');
  ok(t.includes(`${api.activeDays} de 30 dias ativos`), `dias ativos (${api.activeDays}/30)`);
  ok(t.includes(`${api.workDays}/30`), `frequência de trabalho (${api.workDays}/30)`);
  await page.screenshot({ path: OUT + 'dash-month-light.png', fullPage: true });

  // hoje
  await pick('Hoje');
  api = await dash('day');
  t = await text();
  ok(t.includes('vs ontem'), 'hoje compara com ontem');
  ok(
    !(await page.$('[aria-label="Tempo registrado por dia"]')),
    'no modo "Hoje" não desenha gráficos por dia (sem barra única)',
  );
  ok(
    t.includes('Distribuição de hoje') || t.includes('Nenhum tempo registrado'),
    'mostra distribuição do dia',
  );

  // escuro + mobile + overflow em todos os períodos
  await pick('7 dias');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await sleep(300);
  await page.screenshot({ path: OUT + 'dash-week-dark.png', fullPage: true });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('figure');
  for (const r of ['7 dias', '30 dias', 'Hoje']) {
    await pick(r);
    const o = await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
    );
    ok(o <= 0, `celular sem rolagem horizontal em "${r}" (${o}px)`);
  }
  await pick('30 dias');
  await page.screenshot({ path: OUT + 'dash-mobile-dark.png', fullPage: true });

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
