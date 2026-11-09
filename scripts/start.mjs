#!/usr/bin/env node
/**
 * Inicia o Kortex em modo "produção": compila o web (se algo mudou) e sobe
 * a API servindo o app na mesma porta.
 *
 *   npm start               só neste computador  → http://localhost:3333
 *   npm run start:lan       também pelo celular na mesma rede (Wi-Fi)
 *   npm start -- --port 4000
 *   npm start -- --no-build      não recompila
 *   npm start -- --dry-run       só mostra o que faria
 *
 * Para desenvolver (hot reload), use `npm run dev`.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST = path.join(ROOT, 'apps', 'web', 'dist');
/** Pastas/arquivos cuja mudança exige recompilar o web. */
const WEB_SOURCES = [
  path.join(ROOT, 'apps', 'web', 'src'),
  path.join(ROOT, 'apps', 'web', 'public'),
  path.join(ROOT, 'apps', 'web', 'index.html'),
  path.join(ROOT, 'apps', 'web', 'vite.config.ts'),
  path.join(ROOT, 'packages', 'shared', 'src'),
];

/** Lê os argumentos de linha de comando. */
export function parseArgs(argv, env = {}) {
  const out = {
    lan: false,
    build: true,
    dryRun: false,
    port: undefined,
    host: undefined,
    errors: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lan') out.lan = true;
    else if (a === '--no-build') out.build = false;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--port' || a === '--host') {
      const v = argv[++i];
      if (!v || v.startsWith('--')) out.errors.push(`${a} precisa de um valor`);
      else if (a === '--port') {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 65535) out.errors.push(`porta inválida: ${v}`);
        else out.port = n;
      } else out.host = v;
    } else out.errors.push(`opção desconhecida: ${a}`);
  }
  // --lan escuta em todas as interfaces; sem ela, só em 127.0.0.1 (HOST do ambiente é respeitado).
  out.host ??= out.lan ? '0.0.0.0' : (env.HOST ?? '127.0.0.1');
  out.port ??= env.PORT ? Number(env.PORT) : 3333;
  return out;
}

/** Data de modificação mais recente de um arquivo ou de tudo dentro de uma pasta. */
function newestMtime(target) {
  if (!fs.existsSync(target)) return 0;
  const st = fs.statSync(target);
  if (!st.isDirectory()) return st.mtimeMs;
  return fs
    .readdirSync(target)
    .reduce((m, f) => Math.max(m, newestMtime(path.join(target, f))), st.mtimeMs);
}

/** Precisa compilar? (sem dist, ou algum arquivo-fonte mais novo que o build) */
export function needsBuild(sources = WEB_SOURCES, dist = WEB_DIST) {
  const built = path.join(dist, 'index.html');
  if (!fs.existsSync(built)) return true;
  const builtAt = fs.statSync(built).mtimeMs;
  return sources.some((s) => newestMtime(s) > builtAt);
}

function main() {
  const args = parseArgs(process.argv.slice(2), process.env);
  if (args.errors.length) {
    console.error(
      `[erro] ${args.errors.join('; ')}\nUso: npm start [-- --lan] [--port N] [--no-build]`,
    );
    process.exit(2);
  }
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    console.error('[erro] Dependências não instaladas. Rode primeiro: npm install');
    process.exit(1);
  }

  const build = args.build && needsBuild();
  console.log(
    `Kortex · ${args.host === '0.0.0.0' ? 'rede local (celular)' : args.host === '127.0.0.1' ? 'só neste computador' : args.host}`,
  );
  if (args.dryRun) {
    console.log(
      `[dry-run] compilar: ${build ? 'sim' : 'não'} · HOST=${args.host} PORT=${args.port} NODE_ENV=production`,
    );
    return;
  }

  if (build) {
    console.log('Compilando o app (primeira vez ou houve mudanças)…');
    const r = spawnSync('npm', ['run', 'build', '-w', '@kortex/web'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
    if (r.status !== 0) {
      console.error('[erro] A compilação falhou. Veja as mensagens acima.');
      process.exit(r.status ?? 1);
    }
  }

  const child = spawn('npm', ['run', 'start', '-w', '@kortex/api'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'production', HOST: args.host, PORT: String(args.port) },
  });
  const stop = () => child.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code) => process.exit(code ?? 0));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
