# Kortex — Arquitetura

## Modelo de uso

**Local-first, 1 usuário por instalação.** Cada pessoa clona o repositório e roda a própria instância, com o próprio arquivo SQLite (`data/kortex.db`). Os dados ficam isolados por natureza: sem cadastro, sem nuvem, sem multiusuário.

Um **PIN opcional** protege o acesso quando o Kortex é aberto por outros aparelhos (celular, rede local, Tailscale). Distribuição: `git clone` → `npm install` → `npm start`.

## Stack

| Camada    | Tecnologia                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| Monorepo  | npm workspaces: `apps/api`, `apps/web`, `packages/shared`                                                             |
| Frontend  | Vite + React 19 + TypeScript, Tailwind CSS v4, React Router, TanStack Query, Zustand, dnd-kit, lucide-react           |
| Backend   | Fastify + TypeScript, Drizzle ORM + better-sqlite3, Zod, `@fastify/static`, fflate (zip do CSV)                       |
| Banco     | SQLite (WAL, `foreign_keys=ON`). Schema em [`DATABASE.sql`](./DATABASE.sql); migrations em `apps/api/drizzle/`        |
| Scripts   | Python 3 (só biblioteca padrão): backup, exportação, restauração, reset de PIN. Node: launcher `scripts/start.mjs`    |
| Qualidade | ESLint + Prettier, Vitest (API e web), `unittest` (Python), `node --test` (launcher), axe-core + Puppeteer (E2E/a11y) |

Os gráficos (barras, mapa de constância, anel de progresso) são SVG/HTML próprios em `components/charts`, sem biblioteca de gráficos.

## Estrutura

```
Kortex/
├── apps/
│   ├── api/src/
│   │   ├── db/                  schema (Drizzle), client, migrate, seed
│   │   ├── lib/                 ordering (posições fracionárias), calendar (datas sem fuso)
│   │   ├── plugins/             error-handler, request-guard (Host/CSRF)
│   │   ├── modules/<domínio>/   routes.ts + service.ts (+ testes):
│   │   │   ideas · projects · finance · reminders · studies · time · health
│   │   │   goals · dashboard · backup · auth · network · settings
│   │   ├── app.ts               monta o Fastify (hooks de segurança, estáticos, rotas)
│   │   └── server.ts            entrada: migra, semeia, backup automático, escuta
│   └── web/src/
│       ├── app/                 rotas, gate de PIN, navegação
│       ├── components/          ui (design system), kanban, charts, layout, ErrorBoundary
│       ├── features/<módulo>/   api.ts (TanStack Query) + páginas/modais por módulo
│       ├── lib/                 api client, datas, dinheiro, duração, parser de captura…
│       └── stores/              Zustand: tema, auth, foco, toast, PWA
│   └── web/public/              manifest, ícones, service worker
├── packages/shared/             enums, schemas Zod e tipos usados por API e web
├── scripts/                     start.mjs · backup.py · export.py · restore.py · reset_pin.py (+ tests/)
├── docs/                        ARCHITECTURE.md · DATABASE.sql · ACESSO-REMOTO.md
└── data/                        kortex.db e backups/ (ignorados pelo git)
```

## Decisões que não são óbvias no código

- **Horários "flutuantes".** Lembretes e sessões de tempo guardam hora **local sem fuso** (`2026-11-20T15:00`), como uma agenda de papel: 15h é 15h, sem surpresas de fuso ou horário de verão, e "quanto estudei na terça" é só o prefixo da data. O cliente informa o "hoje" local (`?today=`) para semana/sequências.
- **Ordem dos Kanbans** por `position REAL` (índice fracionário): mover um card costuma ser 1 `UPDATE`; a coluna é renumerada só quando o espaço entre vizinhos acaba (`lib/ordering.ts`).
- **Tempo é uma tabela só** (`time_entries`, polimórfica por `module` + `ref_id`): sessões de estudo, Modo Foco, trabalho e projetos alimentam Estudos e Dashboard sem duplicar lógica.
- **Histórico financeiro automático**: cada edição vira um registro com o antes/depois (`finance_entries`); registros automáticos são imutáveis.
- **Backup/restauração** usam o mesmo formato JSON (`kortex-backup` v1) na API e nos scripts Python; restaurar roda numa transação e **sempre salva antes** uma cópia `.db`.
- **Sequências (streaks)** pulam dias em que a meta não vale e não quebram enquanto "hoje" ainda está pendente.

## Segurança

- Servidor escuta só em `127.0.0.1` por padrão; `npm run start:lan` abre para a rede e o terminal avisa se estiver **sem PIN**.
- **PIN**: hash `scrypt` com sal; sessão em cookie `HttpOnly` + `SameSite=Lax` assinado (HMAC, 30 dias, `Secure` atrás de HTTPS); trocar o PIN troca o segredo e derruba as outras sessões; 5 erros seguidos travam o login (30 s, dobrando até 15 min).
- **Sem CORS** (a web é sempre da mesma origem). Pedidos que alteram dados exigem `Sec-Fetch-Site: same-origin` (fallback Origin/Host para navegadores antigos) e todo pedido passa por uma **lista de Hosts aceitos** (barra _DNS rebinding_). `KORTEX_ALLOWED_HOSTS` libera domínios próprios.
- Respostas de `/api` saem com `Cache-Control: no-store`; o service worker nunca guarda a API.

## Design

Neomorfismo minimalista, claro (off-white) e escuro (cinza), accent **azul bebê neon**. Tokens em `apps/web/src/styles/index.css`.

| Token                                                | Claro                            | Escuro                |
| ---------------------------------------------------- | -------------------------------- | --------------------- |
| Fundo                                                | `#EEF1F5`                        | `#1E2128`             |
| Superfície                                           | `#F6F8FB`                        | `#252932`             |
| Texto / texto secundário                             | `#1B2230` / `#5B6678`            | `#E6EAF0` / `#9AA3B2` |
| **Accent** (preenchimentos, ativos, seleção, brilho) | `#6FE3FF`                        | `#6FE3FF`             |
| Accent como **texto/ícone** (`accent-ink`)           | `#07729A` (o neon some no claro) | `#6FE3FF`             |
| Erro como texto (`danger`)                           | `#C62828`                        | `#FF6B6B`             |
| Série única de gráficos (`chart-1`)                  | `#07729A`                        | `#1FA3D1`             |

- **Paleta categórica** do Dashboard (Estudo, Trabalho, Projetos, Ideias, Finanças, Outro), validada com o validador de paleta (separação para daltonismo e visão normal nos dois temas); no tema claro três cores ficam abaixo de 3:1 contra o fundo, então todo gráfico tem **legenda, valores diretos/tooltip e tabela equivalente**.
- Cores de **categorias da agenda** são do usuário (Configurações → Categorias da agenda).

## Acessibilidade

Auditada com **axe-core** (WCAG 2.2 AA + boas práticas) em todas as páginas, nos dois temas, no desktop e no celular, e em 15 estados interativos (modais, formulários, captura rápida, Modo Foco): **0 violações**. Além disso:

- Link "Pular para o conteúdo", título da aba por página e foco no conteúdo ao navegar.
- Kanban operável por teclado (Espaço/setas/Esc; Enter abre) com anúncios em português para leitores de tela.
- Gráficos com tabela equivalente para leitores de tela; informação nunca só por cor.
- Sem rolagem lateral a 320 px; respeita `prefers-reduced-motion`.
- `ErrorBoundary` evita tela branca (inclusive quando uma aba antiga não consegue baixar uma página após atualizar).

## PWA

Manifest + ícones (`any`, `maskable`, `apple-touch`) + service worker que guarda só o "casco" do app (HTML/JS/CSS/ícones). O app instalado abre sem rede, mas **os dados vêm do servidor**. Instalar exige HTTPS ou `localhost` (ver [ACESSO-REMOTO.md](./ACESSO-REMOTO.md)).

## Modelo de dados (resumo)

- **Config:** `settings` (chave/valor; guarda também `pin_hash`, `pin_numeric` e `session_secret`, que nunca saem pela API)
- **Ideias:** `ideas` (organized → started → developing → done; pode virar projeto)
- **Projetos:** `projects` (idea → started → development[nível 1/2/3] → done → deployed; datas automáticas)
- **Finanças:** `finance_activities` (idea / development / active) + `finance_entries` (histórico, notas, avisos)
- **Agenda:** `reminder_categories`, `reminders` (recorrência diária/semanal/mensal), `reminder_completions`
- **Estudos / tempo:** `study_subjects` + `time_entries`
- **Saúde:** `workouts`, `meal_plan`, `meal_logs`
- **Metas:** `daily_goals`, `goal_checks`
- `tags` e `entity_tags` existem no schema para uso futuro (ainda sem tela).
