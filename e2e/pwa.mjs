import puppeteer from 'puppeteer-core';
import { CHROME, OUT } from './lib.mjs';
import http from 'node:http';

const BASE = 'http://localhost:3398';
// ── Proteção: só roda contra o servidor de PRODUÇÃO DE TESTE (porta 3398, banco test.db) ──
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
const get = (p, init) => fetch(BASE + p, init);
const PIN = '4821';
/** Requisição HTTP crua, para controlar cabeçalhos que o fetch proíbe (Host, Sec-Fetch-Site). */
const raw = (method, path, headers = {}, body) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 3398,
        method,
        path,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      },
    );
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--blink-settings=preferredColorScheme=1'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  const t = m.text();
  // 401/429 esperados nos testes de PIN; falha de rede esperada no teste offline
  if (
    m.type() === 'error' &&
    !/40[01]|429|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(t)
  )
    errors.push(t);
});
const text = async () => (await page.evaluate(() => document.body.textContent)).replace(/\s/g, ' ');
const clickText = (sel, t) =>
  page.$$eval(
    sel,
    (els, t) => {
      const e = els.find((x) => x.textContent.trim() === t || x.textContent.includes(t));
      if (!e) throw new Error('não achei: ' + t);
      e.click();
    },
    t,
  );

try {
  // ───────── 1) Servidor único: API + app compilado ─────────
  const idx = await get('/');
  const html = await idx.text();
  ok(
    idx.status === 200 && html.includes('<div id="root">'),
    'GET / entrega o app compilado (um servidor só)',
  );
  ok(
    idx.headers.get('cache-control') === 'no-cache',
    'index.html sempre revalida (atualizações chegam na hora)',
  );
  const asset = html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
  ok(
    asset && (await get(asset)).headers.get('cache-control').includes('immutable'),
    `assets com hash são imutáveis (${asset})`,
  );
  ok(
    (await get('/api/ideas')).headers.get('cache-control') === 'no-store',
    'respostas da API nunca ficam em cache',
  );
  const deep = await get('/saude');
  ok(
    deep.status === 200 && (await deep.text()).includes('<div id="root">'),
    'link direto /saude funciona (fallback do React Router)',
  );
  ok(
    (await get('/assets/nao-existe.js')).status === 404 &&
      (await get('/api/nao-existe')).status === 404,
    'arquivos e rotas de API inexistentes dão 404 de verdade',
  );

  // ───────── 1b) Defesas contra sites maliciosos (servidor real) ─────────
  const rebinding = await raw('GET', '/api/export', { host: 'evil.example:3398' });
  ok(
    rebinding.status === 403 && rebinding.body.includes('BAD_HOST'),
    'DNS rebinding: Host "evil.example" não lê /api/export',
  );
  ok(
    (await raw('GET', '/', { host: 'evil.example:3398' })).status === 403,
    'DNS rebinding: nem o app é servido para Host desconhecido',
  );
  const csrf = await raw(
    'POST',
    '/api/ideas',
    { host: 'localhost:3398', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    { title: 'invasor' },
  );
  ok(
    csrf.status === 403 && csrf.body.includes('BAD_ORIGIN'),
    'CSRF: POST de outro site é recusado',
  );
  const proxied = await raw(
    'POST',
    '/api/ideas',
    { host: '127.0.0.1:3398', origin: 'http://localhost:5173', 'sec-fetch-site': 'same-origin' },
    { title: 'via proxy' },
  );
  ok(proxied.status === 201, 'POST do próprio app passa mesmo com Origin ≠ Host (atrás de proxy)');
  ok(
    !(await (await get('/api/ideas')).json()).some((i) => i.title === 'invasor'),
    'o POST bloqueado não criou nada',
  );

  // ───────── 2) Manifest e ícones ─────────
  const man = await (await get('/manifest.webmanifest')).json();
  ok(
    man.name === 'Kortex' && man.display === 'standalone' && man.start_url === '/',
    'manifest: nome, standalone e start_url',
  );
  ok(
    man.icons.some((i) => i.sizes === '192x192') &&
      man.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any') &&
      man.icons.some((i) => i.purpose === 'maskable'),
    'manifest: ícones 192, 512 e maskable',
  );
  for (const i of man.icons) {
    const r = await get(i.src);
    const b = Buffer.from(await r.arrayBuffer());
    const [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
    ok(
      r.headers.get('content-type') === 'image/png' && `${w}x${h}` === i.sizes,
      `ícone ${i.src} é PNG ${w}x${h}`,
    );
  }

  // ───────── 3) Navegador: service worker, instalabilidade, offline ─────────
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('nav');
  const swScope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  ok(swScope === BASE + '/', `service worker ativo (escopo ${swScope})`);
  await page.reload({ waitUntil: 'networkidle0' });
  ok(
    await page.evaluate(() => !!navigator.serviceWorker.controller),
    'a página passa a ser controlada pelo service worker',
  );
  const cdp = await page.createCDPSession();
  await cdp.send('Page.enable');
  const inst = await cdp.send('Page.getInstallabilityErrors');
  ok(
    inst.installabilityErrors.length === 0,
    `Chrome não aponta erros de instalabilidade (${JSON.stringify(inst.installabilityErrors.map((e) => e.errorId))})`,
  );
  const parsed = await cdp.send('Page.getAppManifest');
  ok(!(parsed.errors ?? []).length, 'Chrome leu o manifest sem erros/avisos');

  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav', { timeout: 15000 });
  ok(true, 'OFFLINE: o app abre pelo cache (casco do app)');
  ok(
    (await page.evaluate(() =>
      fetch('/api/ideas').then(
        () => 'servido',
        () => 'falhou',
      ),
    )) === 'falhou',
    'OFFLINE: dados da API NÃO vêm do cache (nunca guardados)',
  );
  await page.setOfflineMode(false);

  // ───────── 4) Cartões de Configurações ─────────
  await page.goto(BASE + '/configuracoes', { waitUntil: 'networkidle0' });
  await page.waitForSelector('section[aria-label="Backups"]');
  let t = await text();
  ok(
    t.includes('Sem PIN') && t.includes('Só neste computador'),
    'cartões mostram "Sem PIN" e "Só neste computador"',
  );
  ok(t.includes('npm run start:lan'), 'explica como abrir para a rede (npm run start:lan)');
  await page.screenshot({ path: OUT + 'pwa-settings-light.png', fullPage: true });

  // ───────── 5) PIN pelo navegador ─────────
  await clickText('button', 'Criar PIN');
  const pinInputs = async () => page.$$('form input[type="password"]');
  let [a, b] = await pinInputs();
  await a.type('12');
  await b.type('13');
  await clickText('button[type="submit"]', 'Ativar PIN');
  await sleep(300);
  t = await text();
  ok(
    t.includes('Use ao menos 4 caracteres') && t.includes('precisam ser iguais'),
    'valida PIN curto e confirmação diferente',
  );
  [a, b] = await pinInputs();
  await a.click({ clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await a.type(PIN);
  await b.click({ clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await b.type(PIN);
  await clickText('button[type="submit"]', 'Ativar PIN');
  await page.waitForFunction(() => document.body.textContent.includes('PIN ativado'));
  ok((await (await get('/api/auth/status')).json()).pinEnabled === true, 'PIN ativado no servidor');
  ok((await get('/api/ideas')).status === 401, 'sem cookie a API agora responde 401');
  ok(
    (await page.evaluate(() => fetch('/api/ideas').then((r) => r.status))) === 200,
    'este navegador continua logado depois de criar o PIN',
  );

  // recarregar → continua dentro (cookie); limpar cookie → tela de bloqueio
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('nav');
  ok(true, 'recarregar mantém a sessão (cookie HttpOnly de 30 dias)');
  const cookie = (await page.cookies()).find((c) => c.name === 'kortex_session');
  ok(
    cookie?.httpOnly && cookie.sameSite === 'Lax',
    'cookie é HttpOnly + SameSite=Lax (JS da página não consegue ler)',
  );
  await page.deleteCookie(cookie);
  await clickText('nav a', 'Ideias'); // dispara chamada à API sem sessão
  await page.waitForSelector('#lock-title', { timeout: 10000 });
  ok(true, 'sessão perdida no meio do uso → tela de PIN aparece sozinha');
  ok(
    (await page.$eval('input[aria-label="PIN"]', (i) => i.getAttribute('inputmode'))) === 'numeric',
    'PIN só de números → teclado numérico no celular',
  );
  await page.screenshot({ path: OUT + 'pwa-lock-light.png' });

  // PIN errado
  await page.type('input[aria-label="PIN"]', '0000');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() =>
    document.getElementById('lock-error')?.textContent.includes('PIN incorreto'),
  );
  ok(true, 'PIN errado mostra "PIN incorreto" e limpa o campo');
  ok(
    (await page.$eval('input[aria-label="PIN"]', (i) => i.value)) === '',
    'campo limpo após o erro',
  );
  // PIN certo
  await page.type('input[aria-label="PIN"]', PIN);
  await page.keyboard.press('Enter');
  await page.waitForSelector('nav');
  await page.waitForFunction(() => !document.getElementById('lock-title'));
  ok(true, 'PIN certo libera o app');
  ok(
    await page.evaluate(() => fetch('/api/ideas').then((r) => r.ok)),
    'a API volta a responder 200',
  );

  // Sair deste aparelho
  await page.goto(BASE + '/configuracoes', { waitUntil: 'networkidle0' });
  await page.waitForSelector('section[aria-label="Backups"]');
  await clickText('button', 'Sair deste aparelho');
  await page.waitForSelector('#lock-title');
  ok(true, '"Sair deste aparelho" volta para a tela de PIN');
  await page.type('input[aria-label="PIN"]', PIN);
  await page.keyboard.press('Enter');
  await page.waitForSelector('nav');

  // Trocar PIN pelo formulário e remover
  await page.goto(BASE + '/configuracoes', { waitUntil: 'networkidle0' });
  await page.waitForSelector('section[aria-label="Backups"]');
  await clickText('button', 'Remover PIN');
  [a] = await pinInputs();
  await a.type('errado');
  await clickText('button[type="submit"]', 'Remover PIN');
  await page.waitForFunction(() => document.body.textContent.includes('PIN incorreto'));
  ok(true, 'remover com PIN atual errado é recusado');
  await a.click({ clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await a.type(PIN);
  await clickText('button[type="submit"]', 'Remover PIN');
  await page.waitForFunction(() => document.body.textContent.includes('PIN removido'));
  ok(
    (await (await get('/api/auth/status')).json()).pinEnabled === false,
    'PIN removido; a API volta a abrir sem senha',
  );
  ok((await get('/api/ideas')).status === 200, 'sem cookie a API responde 200 de novo');

  // ───────── 6) Celular ─────────
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/configuracoes', { waitUntil: 'networkidle0' });
  await page.waitForSelector('section[aria-label="Backups"]');
  const o = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
  );
  ok(o <= 0, `Configurações no celular sem rolagem lateral (${o}px)`);
  await page.screenshot({ path: OUT + 'pwa-settings-mobile-dark.png', fullPage: true });
  // tela de bloqueio no celular (cria PIN via API do próprio navegador e apaga o cookie)
  await page.evaluate(
    (pin) =>
      fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      }),
    PIN,
  );
  await page.deleteCookie(...(await page.cookies()));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#lock-title');
  ok(
    (await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
    )) <= 0,
    'tela de PIN no celular sem rolagem lateral',
  );
  await page.screenshot({ path: OUT + 'pwa-lock-mobile-dark.png' });
  // limpeza: remove o PIN para não deixar o banco de teste travado
  await page.type('input[aria-label="PIN"]', PIN);
  await page.keyboard.press('Enter');
  await page.waitForSelector('nav');
  await page.evaluate(
    (pin) =>
      fetch('/api/auth/pin/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin: pin }),
      }),
    PIN,
  );

  ok(errors.length === 0, `sem erros no console ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
