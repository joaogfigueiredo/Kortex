// Utilidades compartilhadas pelas suítes de navegador (Puppeteer).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

/** Navegador usado nos testes. Defina CHROME_PATH se o seu estiver em outro lugar. */
export const CHROME = process.env.CHROME_PATH ?? CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error(
    'Chrome/Edge não encontrado. Defina a variável CHROME_PATH com o caminho do executável.',
  );
  process.exit(2);
}

/** Pasta de capturas de tela e arquivos temporários dos testes (ignorada pelo git). */
export const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
