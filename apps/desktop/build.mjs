// Monta apps/desktop/stage: o app Electron pronto para empacotar.
//   stage/main.cjs       processo principal
//   stage/server.mjs     API inteira num arquivo só (esbuild); só o sqlite fica de fora (nativo)
//   stage/web/           web compilado        stage/drizzle/   migrations
//   stage/node_modules/better-sqlite3        (binário N-API: serve para Node e Electron)
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const STAGE = path.join(HERE, 'stage');
const rel = (p) => path.relative(ROOT, p);

console.log('▸ compilando o web…');
execSync('npm run build -w @kortex/web', { cwd: ROOT, stdio: 'inherit' });

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

console.log('▸ empacotando a API…');
await build({
  entryPoints: [path.join(ROOT, 'apps/api/src/server.ts')],
  outfile: path.join(STAGE, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['better-sqlite3'],
  // Dependências CommonJS do Fastify usam require()/__dirname dentro do bundle ESM.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'warning',
});

fs.cpSync(path.join(ROOT, 'apps/web/dist'), path.join(STAGE, 'web'), { recursive: true });
fs.cpSync(path.join(ROOT, 'apps/api/drizzle'), path.join(STAGE, 'drizzle'), { recursive: true });
fs.copyFileSync(path.join(HERE, 'main.cjs'), path.join(STAGE, 'main.cjs'));
fs.copyFileSync(path.join(HERE, 'assets/icon.png'), path.join(STAGE, 'icon.png'));

// better-sqlite3: só o que roda (lib + binário do Windows), sem fontes C++.
const sqliteSrc = path.join(ROOT, 'node_modules/better-sqlite3');
const sqliteDst = path.join(STAGE, 'node_modules/better-sqlite3');
fs.mkdirSync(path.join(sqliteDst, 'prebuilds'), { recursive: true });
fs.cpSync(path.join(sqliteSrc, 'lib'), path.join(sqliteDst, 'lib'), { recursive: true });
fs.copyFileSync(path.join(sqliteSrc, 'package.json'), path.join(sqliteDst, 'package.json'));
for (const f of fs
  .readdirSync(path.join(sqliteSrc, 'prebuilds'))
  .filter((n) => n.startsWith('win32-x64')))
  fs.copyFileSync(path.join(sqliteSrc, 'prebuilds', f), path.join(sqliteDst, 'prebuilds', f));

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
fs.writeFileSync(
  path.join(STAGE, 'package.json'),
  JSON.stringify(
    {
      name: 'kortex',
      productName: 'Kortex',
      version,
      description: 'Kortex — sistema de organização e produtividade pessoal',
      author: 'Kortex',
      main: 'main.cjs',
      // Declarado para o electron-builder incluir node_modules/better-sqlite3 no pacote.
      dependencies: {
        'better-sqlite3': JSON.parse(fs.readFileSync(path.join(sqliteSrc, 'package.json'), 'utf8'))
          .version,
      },
    },
    null,
    2,
  ),
);
console.log(`✔ stage pronto em ${rel(STAGE)}`);
