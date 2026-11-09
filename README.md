# Kortex

Sistema pessoal de organização e produtividade: Kanbans de ideias, projetos e atividades financeiras, lembretes com calendário, estudos, saúde, metas diárias, Modo Foco e dashboard.

**Local-first:** cada pessoa roda a própria instância, e os dados ficam num arquivo SQLite em `data/kortex.db`. Nada sai da sua máquina.

## Requisitos

- Node.js 20+ (testado no 26)
- Python 3.10+ (opcional, só para os scripts de backup e exportação)

## Instalação e uso

```bash
git clone https://github.com/joaogfigueiredo/Kortex.git
cd Kortex
npm install
npm start          # compila o app na primeira vez e abre em http://localhost:3333
```

Na primeira execução o banco é criado, as migrations são aplicadas e entram dados de exemplo (categorias, metas e refeições).
Nas próximas, o app só é recompilado se o código mudou.

| Quero…                                    | Comando                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Usar o Kortex neste computador            | `npm start`                                                                                     |
| Abrir também **no celular** (mesmo Wi-Fi) | `npm run start:lan` (o endereço aparece no terminal e em _Configurações → Acesso pelo celular_) |
| Mudar a porta                             | `npm start -- --port 4000`                                                                      |
| Desenvolver (hot reload)                  | `npm run dev` → web em `localhost:5173`, API em `localhost:3333`                                |

> **Windows:** na primeira vez que usar `start:lan`, o firewall pergunta se o Node pode receber conexões. Permita em **redes privadas**.

### No celular

1. **Crie um PIN** em _Configurações → Segurança_ antes de abrir o Kortex pela rede (sem PIN, qualquer pessoa na sua rede entra).
2. Abra o endereço mostrado em _Acesso pelo celular_.
3. Para **instalar como app** (ícone na tela inicial, tela cheia, abre sem internet), o navegador exige **HTTPS**. A forma mais simples é o Tailscale, que ainda dá acesso de qualquer lugar: veja o [guia de acesso remoto](docs/ACESSO-REMOTO.md).

## Segurança

- **PIN opcional** (4 a 64 caracteres), guardado só como hash `scrypt`. A sessão fica num cookie `HttpOnly` por 30 dias em cada aparelho. Trocar o PIN desconecta os outros aparelhos.
- Após 5 PINs errados seguidos o login trava (30 s, dobrando até 15 min).
- Sem CORS, com checagem de origem (`Sec-Fetch-Site`) e lista de endereços aceitos (barra _DNS rebinding_): páginas de outros sites não conseguem ler nem alterar seus dados.
- Por padrão o servidor escuta só em `127.0.0.1` (este computador). A rede só é aberta com `start:lan`, e o terminal avisa se estiver aberto **sem PIN**.
- Esqueceu o PIN? Rode `npm run reset-pin`: ele remove só o PIN e as sessões (seus dados continuam intactos) e você cria outro em _Configurações → Segurança_.

## Acessibilidade

Auditado com axe-core (WCAG 2.2 AA) em todas as páginas, nos dois temas, no desktop e no celular: 0 violações. Funciona só com teclado (Espaço/setas movem cards do Kanban, Enter abre, `N` captura rápida, `F` Modo Foco), com leitor de tela e a partir de 320 px de largura.

### Testes de navegador

`npm run test:e2e` roda 16 suítes (Puppeteer + axe-core) contra servidores **isolados** (portas 3399/5199/3398 e banco temporário; nunca toca em `data/kortex.db`). Precisa de Chrome ou Edge (`CHROME_PATH` se estiver em outro lugar). `-- --only=ideas,kbd` roda só algumas; capturas e logs ficam em `e2e/out/`.

## Scripts

| Comando                        | O que faz                                                        |
| ------------------------------ | ---------------------------------------------------------------- |
| `npm start`                    | Compila (se preciso) e sobe tudo em `http://localhost:3333`      |
| `npm run start:lan`            | Igual, mas acessível pela rede local (celular)                   |
| `npm run dev`                  | API e web com hot reload                                         |
| `npm test`                     | Testes (Vitest)                                                  |
| `npm run test:py`              | Testes dos scripts Python                                        |
| `npm run test:scripts`         | Testes do launcher (`node --test`)                               |
| `npm run typecheck`            | Checagem de tipos em todos os pacotes                            |
| `npm run db:generate`          | Gera uma migration depois de alterar `apps/api/src/db/schema.ts` |
| `npm run db:migrate`           | Aplica as migrations                                             |
| `npm run db:seed`              | Insere dados de exemplo (só em tabelas vazias)                   |
| `npm run backup`               | Backup `.db` em `data/backups` (com rotação)                     |
| `npm run export`               | Exporta tudo para JSON (`-- --format csv` para CSV em .zip)      |
| `npm run restore -- <arquivo>` | Restaura de um `.json` ou `.db` (faz cópia de segurança antes)   |
| `npm run reset-pin`            | Remove o PIN esquecido (sem apagar dados)                        |

## Variáveis de ambiente (opcionais)

| Variável               | Padrão                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                 | `3333`                                                                                                                                       |
| `HOST`                 | `127.0.0.1` (só este computador). `start:lan` usa `0.0.0.0`                                                                                  |
| `KORTEX_DB_PATH`       | `data/kortex.db`                                                                                                                             |
| `KORTEX_BACKUP_DIR`    | `data/backups`                                                                                                                               |
| `KORTEX_AUTO_BACKUP`   | ligado; `0` desativa o backup automático ao iniciar                                                                                          |
| `KORTEX_ALLOWED_HOSTS` | domínios extras aceitos, ex.: `kortex.minhacasa.com,*.exemplo.com`. Já valem: `localhost`, IPs, `*.ts.net`, `*.local` e o nome do computador |

## Backup e exportação

Seus dados ficam só na sua máquina, em `data/kortex.db`. Para não perder nada:

- **Automático:** ao iniciar, o app faz 1 backup por dia em `data/backups/` e guarda os 7 mais recentes.
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

## Atualizar

```bash
git pull
npm install
npm start          # recompila sozinho e aplica migrations novas ao banco existente
```

Seus dados em `data/` não são tocados pelo `git pull` (a pasta é ignorada pelo git).

## Documentação

- [Acesso remoto, HTTPS e instalação como app](docs/ACESSO-REMOTO.md)
- [Roadmap](ROADMAP.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Schema SQL](docs/DATABASE.sql)
