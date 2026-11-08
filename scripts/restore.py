#!/usr/bin/env python3
"""Restaura os dados do Kortex a partir de um backup.

Aceita:
- .json  (exportado pelo app ou por export.py): substitui todos os dados
  numa transação única; se algo estiver inconsistente, nada é alterado.
- .db    (backup do app ou de backup.py): substitui o banco inteiro.

Sempre cria antes um backup de segurança do banco atual
(data/backups/kortex-pre-restore-*.db).

Recomendado: pare o app (Ctrl+C no terminal do `npm run dev`) antes de restaurar.

Exemplos:
    python scripts/restore.py kortex-backup-2026-11-08.json
    python scripts/restore.py data/backups/kortex-auto-2026-11-08_09-00-00-000.db --yes
"""

from __future__ import annotations

import argparse
import json
import socket
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    BACKUP_FORMAT,
    BACKUP_VERSION,
    DEFAULT_DB,
    backup_db,
    columns_of,
    connect,
    data_tables,
    default_backup_dir,
    to_sql_value,
)


class RestoreError(Exception):
    pass


def load_backup(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise RestoreError(f"Não foi possível ler o JSON: {e}") from e
    if (
        not isinstance(data, dict)
        or data.get("format") != BACKUP_FORMAT
        or data.get("version") != BACKUP_VERSION
        or not isinstance(data.get("tables"), dict)
    ):
        raise RestoreError("Arquivo não é um backup do Kortex (formato inválido)")
    for t, rows in data["tables"].items():
        if not isinstance(rows, list):
            raise RestoreError(f'Tabela "{t}" inválida no backup')
    return data


def restore_json(conn: sqlite3.Connection, data: dict) -> dict[str, int]:
    """Substitui todos os dados numa transação; desfaz tudo se houver FK quebrada."""
    tables = data_tables(conn)
    unknown = [t for t in data["tables"] if t not in tables]
    if unknown:
        raise RestoreError(f"Tabelas desconhecidas no backup: {', '.join(unknown)}")

    counts: dict[str, int] = {}
    conn.isolation_level = None  # controle manual da transação
    conn.execute("PRAGMA foreign_keys = OFF")  # só muda fora de transação
    try:
        conn.execute("BEGIN")
        for t in reversed(tables):
            conn.execute(f'DELETE FROM "{t}"')
        for t in tables:
            rows = data["tables"].get(t, [])
            cols = set(columns_of(conn, t))
            for row in rows:
                keys = [k for k in row if k in cols]  # colunas desconhecidas são ignoradas
                if not keys:
                    continue
                col_list = ", ".join('"' + k + '"' for k in keys)
                placeholders = ", ".join("?" for _ in keys)
                conn.execute(
                    f'INSERT INTO "{t}" ({col_list}) VALUES ({placeholders})',
                    [to_sql_value(row[k]) for k in keys],
                )
            counts[t] = len(rows)
        broken = conn.execute("PRAGMA foreign_key_check").fetchall()
        if broken:
            raise RestoreError(f"Backup inconsistente: {len(broken)} referência(s) quebrada(s)")
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.execute("PRAGMA foreign_keys = ON")
    return counts


def restore_db(conn: sqlite3.Connection, source: Path) -> dict[str, int]:
    """Copia um backup .db inteiro para o banco atual (API de backup do SQLite)."""
    src = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
    try:
        if "ideas" not in data_tables(src):
            raise RestoreError("O arquivo .db não parece ser um banco do Kortex")
        counts = {t: src.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0] for t in data_tables(src)}
        src.backup(conn)
    finally:
        src.close()
    return counts


def app_running(port: int = 3333) -> bool:
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Restaura o Kortex a partir de um backup .json ou .db.")
    ap.add_argument("source", type=Path, help="arquivo de backup (.json ou .db)")
    ap.add_argument("--db", type=Path, default=DEFAULT_DB, help="banco a ser substituído (padrão: data/kortex.db)")
    ap.add_argument("--yes", "-y", action="store_true", help="não pedir confirmação")
    args = ap.parse_args(argv)

    if not args.source.exists():
        ap.error(f"arquivo não encontrado: {args.source}")
    kind = args.source.suffix.lower()
    if kind not in (".json", ".db"):
        ap.error("use um arquivo .json ou .db")

    if app_running():
        print("[aviso] O Kortex parece estar rodando (porta 3333). Recomendo parar o app antes de restaurar.")
    if not args.yes:
        ans = input(f"Isto vai SUBSTITUIR todos os dados de {args.db} por {args.source.name}. Continuar? [s/N] ")
        if ans.strip().lower() not in ("s", "sim", "y", "yes"):
            print("Cancelado.")
            return 1

    conn = connect(args.db)
    try:
        safety = backup_db(conn, default_backup_dir(args.db), "pre-restore")
        print(f"[ok] Backup de segurança: {safety}")
        try:
            counts = restore_json(conn, load_backup(args.source)) if kind == ".json" else restore_db(conn, args.source)
        except RestoreError as e:
            print(f"[erro] {e}\n  Nada foi alterado.")
            return 2
    finally:
        conn.close()

    print(f"[ok] Restaurado de {args.source.name}: {sum(counts.values())} registros")
    for t, n in counts.items():
        if n:
            print(f"  {t}: {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
