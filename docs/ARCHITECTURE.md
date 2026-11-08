# Kortex — Arquitetura

## Modelo de uso

**Local-first, 1 usuário por instalação.** Cada pessoa clona o repositório e roda sua própria instância, com seu próprio arquivo SQLite (`data/kortex.db`). Os dados ficam isolados por natureza, sem cadastro nem multiusuário.
Para acessar pelo celular (rede local ou Tailscale), dá para ativar um **PIN opcional** (o hash fica em `settings`).

Distribuição: `git clone` → `npm install` → `npm start` (o app também pode ser instalado como PWA no celular).

## Stack

| Camada    | Tecnologia                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo  | npm workspaces (`apps/web`, `apps/api`, `packages/shared`)                                                                               |
| Frontend  | Vite + React 19 + TypeScript + Tailwind CSS v4, React Router, TanStack Query, Zustand, dnd-kit, Recharts, date-fns (pt-BR), lucide-react |
| Backend   | Fastify + TypeScript, Drizzle ORM + better-sqlite3, Zod                                                                                  |
| Banco     | SQLite (WAL, foreign keys ON). Schema: [`DATABASE.sql`](./DATABASE.sql)                                                                  |
| Scripts   | Python 3, só biblioteca padrão (`sqlite3`, `csv`, `json`, `zipfile`)                                                                     |
| Qualidade | ESLint + Prettier, Vitest                                                                                                                |

## Design tokens

| Token                                                                                   | Claro                                       | Escuro                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| Fundo                                                                                   | `#EEF1F5` (off-white)                       | `#1E2128`                                 |
| Superfície                                                                              | `#F4F6F9`                                   | `#23272F`                                 |
| Sombra clara / escura                                                                   | `#FFFFFF` / `#C9D1DC`                       | `#2A2F38` / `#14171C`                     |
| Texto                                                                                   | `#1B2230`                                   | `#E6EAF0`                                 |
| **Accent** (azul bebê neon): preenchimento de botões, itens ativos, bordas selecionadas | `#6FE3FF`                                   | `#6FE3FF`                                 |
| Accent hover                                                                            | `#3FD4FF`                                   | `#9AEBFF`                                 |
| Texto sobre o accent                                                                    | `#04222D`                                   | `#04222D`                                 |
| Accent como **texto/ícone** (`accent-ink`)                                              | `#0A7FA6` (o neon puro some no fundo claro) | `#6FE3FF`                                 |
| Glow neon                                                                               | `0 0 0 1px #6FE3FF66, 0 0 18px #6FE3FF55`   | `0 0 0 1px #6FE3FF80, 0 0 22px #6FE3FF66` |

**Paleta neon secundária** (categorias, bolinhas do calendário e séries dos gráficos):
Trabalho `#6FE3FF` · Pessoal `#B79CFF` · Saúde `#4DF5B8` · Estudos `#FFD166` · Finanças `#FF8FC7` · Urgente `#FF6B6B`

Neomorfismo: `shadow-neu` (elevado), `shadow-neu-inset` (pressionado), cantos de 16 a 24px. Todo texto fica em contraste AA. No modo claro, o neon entra como preenchimento e brilho, e o texto destacado usa o `accent-ink`.

## Modelo de dados (resumo)

- **Config:** `settings` (chave/valor), `tags` + `entity_tags` (polimórfica)
- **Ideias:** `ideas` (organized → started → developing → done; pode ser promovida a projeto)
- **Lembretes:** `reminder_categories` (cor das bolinhas), `reminders` (recorrência diária/semanal/mensal), `reminder_completions`
- **Projetos:** `projects` (idea → started → development[nível 1/2/3] → done → deployed)
- **Finanças:** `finance_activities` (idea / development / active), `finance_entries` (histórico, notas, avisos)
- **Estudos:** `study_subjects` (nível + progresso)
- **Tempo:** `time_entries` (polimórfica `module` + `ref_id`): alimenta Estudos, Modo Foco e Dashboard
- **Saúde:** `workouts`, `meal_plan`, `meal_logs`
- **Metas:** `daily_goals` (bitmask de dias da semana), `goal_checks`

Ordenação dos Kanbans: `position REAL` (índice fracionário), então mover um card custa 1 UPDATE.

## Árvore de diretórios

```
Kortex/
├── apps/
│   ├── api/                      # Fastify + Drizzle (Node/TS)
│   │   ├── src/
│   │   │   ├── db/               # schema.ts, client.ts, migrations/, seed.ts
│   │   │   ├── modules/          # 1 pasta por domínio: routes.ts + service.ts
│   │   │   │   ├── ideas/  projects/  finance/  reminders/  studies/
│   │   │   │   ├── health/  goals/  time/  dashboard/
│   │   │   │   └── settings/  auth/  backup/
│   │   │   ├── plugins/          # error handler, cors, auth guard
│   │   │   ├── app.ts
│   │   │   └── server.ts         # em produção, serve também o build do web
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   └── web/                      # React + Vite + Tailwind
│       ├── public/               # manifest PWA, ícones
│       ├── src/
│       │   ├── app/              # router, providers, layout (Sidebar / BottomNav)
│       │   ├── components/ui/    # design system neumórfico
│       │   ├── components/kanban/# Board/Column/Card genéricos
│       │   ├── features/         # home, ideas, projects, finance, reminders, studies,
│       │   │                     # health, dashboard, focus, quick-capture, settings
│       │   ├── lib/              # api client, datas, recorrência
│       │   ├── stores/           # zustand: theme, focus, quickCapture
│       │   └── styles/           # tokens.css, index.css
│       ├── vite.config.ts
│       └── package.json
├── packages/shared/              # Zod schemas + tipos + enums
├── scripts/                      # Python: backup.py, export.py, restore.py
├── data/                         # kortex.db + backups/ (ignorado no git)
├── docs/                         # ARCHITECTURE.md, DATABASE.sql
├── ROADMAP.md
├── package.json
└── README.md
```
