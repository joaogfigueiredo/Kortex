// Popula o banco de TESTE com ~30 dias de uso realista (determinístico).

// ── Proteção: só roda contra o servidor de TESTE (porta 5199, banco test.db) ──
{
  const h = await (await fetch('http://localhost:5199/api/health')).json().catch(() => ({}));
  if (h.db !== 'test.db') {
    console.error('ABORTADO: servidor não está usando test.db (db=' + h.db + ')');
    process.exit(3);
  }
}

const BASE = 'http://localhost:5199/api';
const pad = (n) => String(n).padStart(2, '0');
const ds = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = (n) => {
  const d = new Date();
  d.setHours(12);
  d.setDate(d.getDate() + n);
  return ds(d);
};
const TODAY = plus(0);
const call = async (method, path, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && r.status !== 404)
    throw new Error(`${method} ${path} → ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// limpa tempo/treinos/checks/logs
for (const e of await call('GET', '/time?limit=500')) await call('DELETE', `/time/${e.id}`);
for (const w of await call('GET', '/workouts?limit=500')) await call('DELETE', `/workouts/${w.id}`);

const subjects = await call('GET', `/studies?today=${TODAY}`);
const need = async (name, color) =>
  subjects.find((s) => s.name === name) ??
  (await call('POST', `/studies?today=${TODAY}`, { name, color }));
const eng = await need('Inglês', '#B79CFF');
const ts = await need('TypeScript', '#6FE3FF');
const calc = await need('Cálculo', '#FFD166');
if (calc.archived) await call('PATCH', `/studies/${calc.id}?today=${TODAY}`, { archived: false });
const projects = await call('GET', '/projects');
const kortex =
  projects.find((p) => p.title === 'Kortex') ??
  (await call('POST', '/projects', { title: 'Kortex', status: 'development', devLevel: 2 }));
const blog =
  projects.find((p) => p.title.startsWith('Blog')) ??
  (await call('POST', '/projects', { title: 'Blog técnico', status: 'deployed' }));
const fin = (await call('GET', '/finance'))[0];
const ideas = await call('GET', '/ideas');
const goals = (await call('GET', '/goals')).filter((g) => g.active);
const meals = (await call('GET', '/meals')).filter((m) => m.active);

for (let d = -29; d <= 0; d++) {
  const date = plus(d);
  const wd = new Date(`${date}T12:00`).getDay();
  const weekday = wd >= 1 && wd <= 5;
  const t = (h, m) => `${date}T${pad(h)}:${pad(m)}:00`;
  // trabalho nos dias úteis (com alguns faltando)
  if (weekday && rnd() > 0.1)
    await call('POST', '/time', {
      module: 'work',
      startedAt: t(9, 0),
      durationSec: Math.round((2 + rnd() * 4) * 3600),
    });
  // estudo quase todo dia, mais forte nas últimas 2 semanas
  if (rnd() > (d > -14 ? 0.15 : 0.45)) {
    const subj = [eng, ts, ts, calc][Math.floor(rnd() * 4)];
    await call('POST', '/time', {
      module: 'study',
      refId: subj.id,
      startedAt: t(20, 0),
      durationSec: Math.round((25 + rnd() * 70) * 60),
      source: rnd() > 0.5 ? 'focus' : 'manual',
    });
  }
  // projeto à noite em alguns dias
  if (rnd() > 0.55)
    await call('POST', '/time', {
      module: 'project',
      refId: (rnd() > 0.25 ? kortex : blog).id,
      startedAt: t(22, 0),
      durationSec: Math.round((30 + rnd() * 90) * 60),
    });
  if (rnd() > 0.8 && ideas[0])
    await call('POST', '/time', {
      module: 'idea',
      refId: ideas[0].id,
      startedAt: t(18, 30),
      durationSec: Math.round((15 + rnd() * 30) * 60),
    });
  if (rnd() > 0.85 && fin)
    await call('POST', '/time', {
      module: 'finance',
      refId: fin.id,
      startedAt: t(19, 0),
      durationSec: Math.round((20 + rnd() * 40) * 60),
    });
  // treinos seg/qua/sex + às vezes sábado
  if ([1, 3, 5].includes(wd) || (wd === 6 && rnd() > 0.5)) {
    if (rnd() > 0.15)
      await call('POST', '/workouts', {
        date,
        type: wd === 6 ? 'Corrida' : 'Musculação',
        durationMin: Math.round(35 + rnd() * 40),
        intensity: 2 + Math.floor(rnd() * 3),
      });
  }
  // dieta
  for (const m of meals) {
    if (rnd() > 0.15) {
      const r = rnd();
      await call('PUT', `/meals/${m.id}/logs/${date}`, {
        status: r > 0.3 ? 'done' : r > 0.12 ? 'partial' : 'skipped',
      }).catch(() => {});
    }
  }
  // metas
  for (const g of goals)
    if (rnd() > 0.3)
      await call('PUT', `/goals/${g.id}/checks/${date}`, { done: true }).catch(() => {});
}
console.log('seed ok', (await call('GET', '/time?limit=500')).length, 'sessões');
