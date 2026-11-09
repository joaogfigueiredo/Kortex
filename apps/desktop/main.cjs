// Processo principal do Kortex Desktop. Sobe a API (com o web compilado) dentro do
// próprio Electron, só em 127.0.0.1, e abre uma janela apontando para ela.
const { app, BrowserWindow, Menu, shell, dialog, nativeTheme } = require('electron');
const net = require('node:net');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PREFERRED_PORT = 38417; // fixa: cookie e localStorage (tema, foco) são por origem
const HOST = '127.0.0.1';

// Permite isolar os dados (testes). Normal: %APPDATA%\Kortex.
if (process.env.KORTEX_USER_DATA) app.setPath('userData', process.env.KORTEX_USER_DATA);

let win = null;

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, HOST, () => s.close(() => resolve(true)));
  });
}
function randomPort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, HOST, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function waitForServer(port) {
  const until = Date.now() + 30_000;
  while (Date.now() < until) {
    try {
      const r = await fetch(`http://${HOST}:${port}/api/health`);
      if (r.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('O servidor do Kortex não respondeu em 30 segundos.');
}

async function startServer() {
  const port = (await portFree(PREFERRED_PORT)) ? PREFERRED_PORT : await randomPort();
  const dataDir = path.join(app.getPath('userData'), 'data');
  Object.assign(process.env, {
    NODE_ENV: 'production',
    PORT: String(port),
    HOST,
    KORTEX_DATA_DIR: dataDir,
    KORTEX_WEB_DIR: path.join(__dirname, 'web'),
    KORTEX_MIGRATIONS_DIR: path.join(__dirname, 'drizzle'),
    KORTEX_LOG_PRETTY: '0',
  });
  await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  await waitForServer(port);
  return port;
}

function createWindow(port) {
  const origin = `http://${HOST}:${port}`;
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 520,
    show: false,
    title: 'Kortex',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1E2128' : '#EEF1F5',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required', // alarme do Modo Foco
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => (win = null));

  // Tudo que não for o próprio Kortex abre no navegador padrão.
  const external = (url) => {
    if (/^https?:/i.test(url) && !url.startsWith(origin)) shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => (external(url), { action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(origin)) return;
    e.preventDefault();
    external(url);
  });

  win.loadURL(origin);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    try {
      createWindow(await startServer());
    } catch (e) {
      dialog.showErrorBox('Kortex não conseguiu iniciar', String(e?.stack ?? e));
      app.exit(1);
    }
  });
  app.on('window-all-closed', () => app.quit());
}
