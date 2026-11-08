# Kortex — Roadmap

Arquitetura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Schema: [`docs/DATABASE.sql`](docs/DATABASE.sql)

Todo passo termina com o app rodando, uma checagem manual no navegador (desktop e viewport mobile) e um commit.

## Passo 0: Fundação

- [x] `git init`, `.gitignore` (node_modules, `data/`, builds)
- [x] Monorepo com npm workspaces: `apps/api`, `apps/web`, `packages/shared`
- [x] TypeScript base, ESLint e Prettier
- [x] Scripts na raiz: `dev` (api e web juntos), `build`, `start`

## Passo 1: Banco e API base

- [x] Schema Drizzle espelhando `docs/DATABASE.sql`, mais as migrations
- [x] Cliente SQLite (WAL, foreign keys) em `data/kortex.db`
- [x] Seed: categorias de lembrete, metas e refeições de exemplo
- [x] Fastify: `/api/health`, error handler, CORS
- [x] `packages/shared`: enums e schemas Zod

## Passo 2: Design system e layout

- [x] Tokens claro/escuro, utilitários `shadow-neu` / `shadow-neu-inset` e accent neon
- [x] Componentes `ui/`: Card, Button, IconButton, Input, Textarea, Select, Modal, Toggle, Progress, Badge
- [x] Toggle de tema (segue `prefers-color-scheme` e salva em `settings`)
- [x] Layout mobile-first: BottomNav no celular, Sidebar no desktop, rotas de todos os módulos

## Passo 3: Kanban genérico e Ideias

- [x] Board/Column/Card com dnd-kit (toque e teclado), ordenação fracionária
- [x] CRUD de ideias e as 4 colunas (Organizadas e arquitetadas, Iniciadas, Em desenvolvimento, Finalizadas)
- [x] Ação "Promover a projeto"

## Passo 4: Projetos

- [ ] Colunas Ideias, Iniciados, **Desenvolvimento** (Nível 1, 2 e 3), Finalizado e Deployzado
- [ ] Grupo Desenvolvimento colapsável no mobile
- [ ] Datas automáticas (started/finished/deployed), links de repo e deploy

## Passo 5: Atividades financeiras

- [ ] Kanban com Ideias, Desenvolvimento e Ativas
- [ ] Modal completo: detalhes, edição, timeline, observações, avisos com data
- [ ] Registro automático de `status_change` e `edit` no histórico

## Passo 6: Lembretes e agenda

- [ ] CRUD de lembretes, compromissos e avisos, com recorrência diária, semanal (dias da semana) ou mensal
- [ ] API que expande ocorrências por intervalo de datas
- [ ] Calendário mensal com bolinhas coloridas por categoria e lista do dia
- [ ] Conclusão por ocorrência

## Passo 7: Estudos

- [ ] Matérias com progresso visual, nível (Iniciante → Intermediário → Avançado) e última sessão
- [ ] Registro de sessões de estudo (`time_entries`)

## Passo 8: Saúde (treinos e dieta)

- [ ] Registro rápido de treinos
- [ ] Plano de refeições e check diário (feito / parcial / pulado)

## Passo 9: Home e metas diárias

- [ ] Metas recorrentes (diárias ou em dias específicos) com check rápido
- [ ] Mini-agenda interativa e resumo do dia (próximos compromissos, refeições, metas)

## Passo 10: Captura rápida e Modo Foco

- [ ] Botão flutuante global: Ideia ou Lembrete em segundos (com atalho de teclado)
- [ ] Modo Foco em tela cheia: cronômetro ou timer, fundo escuro, botão discreto para pausar/sair, alarme, Wake Lock
- [ ] Sessões salvas em `time_entries`, vinculadas a um módulo ou item

## Passo 11: Dashboard de produtividade

- [ ] Endpoints de agregação (dia, semana, mês)
- [ ] Gráficos: tempo estudado, tempo em ideias e projetos, continuidade (streaks), frequência de trabalho, treinos, cumprimento da dieta, metas

## Passo 12: Backup e exportação

- [ ] `GET /api/export?format=json|csv` (download; o CSV vem em zip com uma tabela por arquivo)
- [ ] Botão de exportar em Configurações
- [ ] Python: `scripts/backup.py` (backup consistente e rotação), `export.py`, `restore.py`
- [ ] Backup automático opcional ao iniciar

## Passo 13: Mobile e distribuição

- [ ] PWA instalável
- [ ] PIN opcional para acesso remoto
- [ ] Documentar o acesso via rede local ou Tailscale
- [ ] `npm start` servindo um build único, README de instalação para os colegas

## Passo 14: Polimento

- [ ] Acessibilidade, animações sutis, estados vazios
- [ ] Testes Vitest: recorrência, agregações, export
