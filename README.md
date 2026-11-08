# Kortex

Sistema pessoal de organização e produtividade: Kanbans de ideias, projetos e atividades financeiras, lembretes com calendário, estudos, saúde, metas diárias, Modo Foco e dashboard.

**Local-first:** cada pessoa roda a própria instância, e os dados ficam num arquivo SQLite em `data/kortex.db`.

## Requisitos

- Node.js 20+ (testado no 26)
- Python 3.10+ (opcional, para os scripts de backup e exportação)

## Instalação

```bash
git clone https://github.com/joaogfigueiredo/Kortex.git
cd Kortex
npm install
npm run dev        # web em http://localhost:5173 · API em http://localhost:3333
```

Para abrir no celular (mesma rede Wi-Fi), rode `npm run dev -w @kortex/web -- --host` junto com a API e acesse o IP da máquina na porta 5173. Acesso fora de casa e PIN entram no Passo 13.

Na primeira execução, o banco é criado, as migrations são aplicadas e os dados de exemplo entram automaticamente.

## Scripts

| Comando                        | O que faz                                                        |
| ------------------------------ | ---------------------------------------------------------------- |
| `npm run dev`                  | API e web com hot reload                                         |
| `npm start`                    | Sobe a API                                                       |
| `npm test`                     | Testes (Vitest)                                                  |
| `npm run typecheck`            | Checagem de tipos em todos os pacotes                            |
| `npm run db:generate`          | Gera uma migration depois de alterar `apps/api/src/db/schema.ts` |
| `npm run db:migrate`           | Aplica as migrations                                             |
| `npm run db:seed`              | Insere dados de exemplo (só em tabelas vazias)                   |
| `npm run backup`               | Backup `.db` em `data/backups` (com rotação)                     |
| `npm run export`               | Exporta tudo para JSON (`-- --format csv` para CSV em .zip)      |
| `npm run restore -- <arquivo>` | Restaura de um `.json` ou `.db` (faz cópia de segurança antes)   |
| `npm run test:py`              | Testes dos scripts Python                                        |

## Variáveis de ambiente (opcionais)

| Variável         | Padrão                                                            |
| ---------------- | ----------------------------------------------------------------- |
| `PORT`           | `3333`                                                            |
| `HOST`           | `127.0.0.1` (use `0.0.0.0` para abrir pelo celular na rede local) |
| `KORTEX_DB_PATH` | `data/kortex.db`                                                  |

## Backup e exportação

Seus dados ficam só na sua máquina, em `data/kortex.db`. Para não perder nada:

- **Automático:** ao iniciar, o app faz 1 backup por dia em `data/backups/` e guarda os 7 mais recentes
  (`KORTEX_AUTO_BACKUP=0` desativa, `KORTEX_BACKUP_DIR` muda a pasta).
- **No app:** _Configurações → Dados e backup_ para exportar **JSON** (restaurável) ou **CSV** (.zip, abre no Excel),
  fazer backup agora, baixar backups e **restaurar** de um JSON.
- **Pelo terminal (Python 3.10+, sem dependências):**
  ```bash
  npm run backup                          # ou: python scripts/backup.py --keep 30 --out D:/Backups
  npm run export -- --format csv          # ou: python scripts/export.py --out meu-backup.json
  npm run restore -- data/backups/kortex-auto-2026-11-08_09-00-00-000.db
  ```
  Restaurar sempre salva antes uma cópia do estado atual (`kortex-pre-restore-*.db` / `kortex-pre-import-*.db`).
  Pare o app antes de restaurar um `.db`.
- **Agendar backups:** veja os exemplos no topo de `scripts/backup.py` (Agendador de Tarefas do Windows ou cron).

Dica: copie `data/backups` para um pendrive ou pasta na nuvem de vez em quando.

## Documentação

- [Roadmap](ROADMAP.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Schema SQL](docs/DATABASE.sql)
