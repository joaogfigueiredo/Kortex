#!/usr/bin/env node
/**
 * Testes de navegador (E2E + acessibilidade) do Kortex.
 *
 *   npm run test:e2e                      roda tudo
 *   npm run test:e2e -- --only=ideas,kbd  só algumas suítes
 *
 * Sobe servidores ISOLADOS, com um banco de teste temporário e portas próprias
 * (API 3399 + web 5199 em modo dev; 3398 em modo produção). Nunca toca em
 * data/kortex.db nem nas portas 3333/5173. Ao terminar (ou ao dar Ctrl+C),
 * encerra todos os processos e apaga o banco temporário.
 *
 * Requer Chrome ou Edge instalado (defina CHROME_PATH se não for encontrado).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUT } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E = path.join(ROOT, 'e2e');
const DEV = { api: 3399, web: 5199 };
const PROD_PORT = 3398;

/** Ordem importa: algumas suítes usam dados deixadas por outras (ex.: kbd usa as ideias de ideias). */
const DEV_SUITES = [
  'seed-month',
  'ideas',
  'kbd',
  'projects',
  'finance',
  'agenda',
  'studies',
  'health',
  'home',
  'focus',
  'dashboard',
  'backup',
  'categories',
  'overflow',
  'a11y',
  'audit',
];
const PROD_SUITES = ['pwa'];

const only = (process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? '')
  .split(',')
  .filter(Boolean);
const wanted = (name) => only.length === 0 || only.includes(name) || name === 'seed-month';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kortex-e2e-'));
const children = [];

function killTree(child) {
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* já encerrou */
    }
  }
}
function cleanup() {
  while (children.length) killTree(children.pop());
  fs.rmSync(tmp, { recursive: true, force: true });
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (cleanup(), process.exit(130)));
process.on('exit', cleanup);

function launch(label, command, cwd, env) {
  const log = fs.openSync(path.join(OUT, `servidor-${label}.log`), 'w');
  const child = spawn(command, {
    cwd,
    shell: true,
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: ['ignore', log, log],
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}

async function waitForTestDb(url, label) {
  const until = Date.now() + 120_000;
  while (Date.now() < until) {
    try {
      const h = await (await fetch(url)).json();
      if (h.db === 'test.db') return;
      throw new Error(
        `o servidor em ${url} usa o banco "${h.db}", não "test.db" — abortando por segurança`,
      );
    } catch (e) {
      if (String(e.message).includes('abortando')) throw e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `o servidor "${label}" não respondeu em 2 minutos (veja e2e/out/servidor-${label}.log)`,
  );
}

function runSuites(names, results) {
  for (const name of names.filter(wanted)) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join(E2E, `${name}.mjs`)], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10 * 60_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    fs.writeFileSync(path.join(OUT, `${name}.log`), output);
    const checks = (output.match(/^✔/gm) ?? []).length;
    const failed = r.status !== 0;
    const isSetup = name === 'seed-month';
    if (!isSetup || failed)
      results.push({ name, checks, failed, secs: ((Date.now() - t0) / 1000).toFixed(0) });
    if (isSetup && !failed) continue;
    console.log(
      `${failed ? '✘' : '✔'} ${name.padEnd(11)} ${String(checks).padStart(3)} checagens  ${((Date.now() - t0) / 1000).toFixed(0)}s`,
    );
    if (failed)
      console.log(
        output
          .split('\n')
          .filter((l) => /FALHOU|ABORTADO|✘|Error|Timeout/.test(l))
          .slice(0, 6)
          .map((l) => `    ${l.trim().slice(0, 220)}`)
          .join('\n'),
      );
  }
}

/** Porta ocupada = outro servidor responderia no lugar do nosso (e poderia usar outro banco). */
function portBusy(port) {
  return new Promise((resolve) => {
    const s = net.createConnection({ port, host: '127.0.0.1' });
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
  });
}

const results = [];
try {
  for (const port of [DEV.api, DEV.web, PROD_PORT]) {
    if (await portBusy(port))
      throw new Error(
        `a porta ${port} já está em uso — encerre o processo que a usa e tente de novo`,
      );
  }
  console.log(`Kortex E2E — bancos temporários em ${tmp}\n`);
  const env = (dir) => {
    fs.mkdirSync(path.join(tmp, dir), { recursive: true });
    return {
      KORTEX_DB_PATH: path.join(tmp, dir, 'test.db'),
      KORTEX_BACKUP_DIR: path.join(tmp, dir, 'backups'),
      KORTEX_AUTO_BACKUP: '0',
    };
  };

  if (DEV_SUITES.some(wanted)) {
    console.log('▸ Modo desenvolvimento (API :%d + Vite :%d)', DEV.api, DEV.web);
    launch('api-dev', 'npm run start -w @kortex/api', ROOT, {
      ...env('dev'),
      PORT: String(DEV.api),
      NODE_ENV: 'development',
    });
    launch('web-dev', `npx vite --port ${DEV.web} --strictPort`, path.join(ROOT, 'apps', 'web'), {
      PORT: String(DEV.api),
    });
    await waitForTestDb(`http://localhost:${DEV.web}/api/health`, 'dev');
    runSuites(DEV_SUITES, results);
    while (children.length) killTree(children.pop()); // libera o banco antes do modo produção
  }

  if (PROD_SUITES.some(wanted)) {
    console.log('\n▸ Modo produção (launcher real: node scripts/start.mjs, :%d)', PROD_PORT);
    launch('prod', `node scripts/start.mjs --port ${PROD_PORT}`, ROOT, env('prod'));
    await waitForTestDb(`http://127.0.0.1:${PROD_PORT}/api/health`, 'prod');
    runSuites(PROD_SUITES, results);
  }
} catch (e) {
  console.error(`\n✘ ${e.message}`);
  results.push({ name: 'infra', checks: 0, failed: true });
}

const total = results.reduce((n, r) => n + r.checks, 0);
const bad = results.filter((r) => r.failed);
console.log(
  `\n${bad.length ? '✘ FALHAS em: ' + bad.map((b) => b.name).join(', ') : '✔ TUDO OK'} — ${results.length} suítes, ${total} checagens`,
);
console.log(`Capturas de tela e logs: ${path.relative(ROOT, OUT)}`);
cleanup();
process.exit(bad.length ? 1 : 0);
