// Testes do launcher (node --test scripts/tests). Sem dependências.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { needsBuild, parseArgs } from '../start.mjs';

test('padrão: só local, porta 3333, compila se precisar', () => {
  assert.deepEqual(
    { ...parseArgs([]), errors: undefined },
    { lan: false, build: true, dryRun: false, port: 3333, host: '127.0.0.1', errors: undefined },
  );
});

test('--lan escuta em todas as interfaces; --port e --no-build', () => {
  const a = parseArgs(['--lan', '--port', '4000', '--no-build']);
  assert.equal(a.host, '0.0.0.0');
  assert.equal(a.port, 4000);
  assert.equal(a.build, false);
  assert.deepEqual(a.errors, []);
});

test('respeita HOST/PORT do ambiente; --host explícito vence --lan', () => {
  assert.equal(parseArgs([], { HOST: '10.0.0.5', PORT: '5000' }).host, '10.0.0.5');
  assert.equal(parseArgs([], { PORT: '5000' }).port, 5000);
  assert.equal(parseArgs(['--lan', '--host', '192.168.0.2']).host, '192.168.0.2');
});

test('argumentos inválidos geram erros claros', () => {
  assert.match(parseArgs(['--port', 'abc']).errors[0], /porta inválida/);
  assert.match(parseArgs(['--port', '70000']).errors[0], /porta inválida/);
  assert.match(parseArgs(['--port']).errors[0], /precisa de um valor/);
  assert.match(parseArgs(['--xyz']).errors[0], /desconhecida/);
});

test('needsBuild: sem dist, fonte mais nova e dist atualizado', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kortex-start-'));
  try {
    const src = path.join(dir, 'src');
    const dist = path.join(dir, 'dist');
    fs.mkdirSync(path.join(src, 'sub'), { recursive: true });
    fs.mkdirSync(dist);
    const file = path.join(src, 'sub', 'a.ts');
    fs.writeFileSync(file, 'x');
    assert.equal(needsBuild([src], dist), true); // sem index.html

    const built = path.join(dist, 'index.html');
    fs.writeFileSync(built, '<html>');
    const now = Date.now() / 1000;
    // Pastas também contam (apagar/criar arquivo muda a data da pasta), então envelhece tudo.
    for (const p of [file, path.join(src, 'sub'), src]) fs.utimesSync(p, now - 100, now - 100);
    fs.utimesSync(built, now - 50, now - 50);
    assert.equal(needsBuild([src], dist), false); // build mais novo que a fonte

    fs.utimesSync(file, now, now); // arquivo em subpasta mudou depois do build
    assert.equal(needsBuild([src], dist), true);
    fs.utimesSync(file, now - 100, now - 100);
    assert.equal(needsBuild([src], dist), false);

    fs.writeFileSync(path.join(src, 'novo.ts'), 'y'); // arquivo novo (muda a data da pasta)
    assert.equal(needsBuild([src], dist), true);
    assert.equal(needsBuild([path.join(dir, 'nao-existe')], dist), false); // fonte ausente é ignorada
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
