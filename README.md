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

| Comando               | O que faz                                                        |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`         | API e web com hot reload                                         |
| `npm start`           | Sobe a API                                                       |
| `npm test`            | Testes (Vitest)                                                  |
| `npm run typecheck`   | Checagem de tipos em todos os pacotes                            |
| `npm run db:generate` | Gera uma migration depois de alterar `apps/api/src/db/schema.ts` |
| `npm run db:migrate`  | Aplica as migrations                                             |
| `npm run db:seed`     | Insere dados de exemplo (só em tabelas vazias)                   |

## Variáveis de ambiente (opcionais)

| Variável         | Padrão                                                            |
| ---------------- | ----------------------------------------------------------------- |
| `PORT`           | `3333`                                                            |
| `HOST`           | `127.0.0.1` (use `0.0.0.0` para abrir pelo celular na rede local) |
| `KORTEX_DB_PATH` | `data/kortex.db`                                                  |

## Documentação

- [Roadmap](ROADMAP.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Schema SQL](docs/DATABASE.sql)
