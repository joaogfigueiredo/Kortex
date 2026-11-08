#!/usr/bin/env python3
"""Backup do banco do Kortex (.db) com rotação.

Usa a API de backup do SQLite: a cópia é consistente mesmo com o app rodando.
O arquivo segue o padrão da API (kortex-<rótulo>-<data>.db), então aparece
também na lista de backups em Configurações.

Exemplos:
    python scripts/backup.py                  # data/backups, mantém 14
    python scripts/backup.py --keep 30
    python scripts/backup.py --out D:/Backups/kortex --label diario

Agendar (Windows): Agendador de Tarefas → ação
    python D:\\dev\\Kortex\\scripts\\backup.py --label diario
Agendar (Linux/macOS, cron diário às 23h):
    0 23 * * * python3 /caminho/Kortex/scripts/backup.py --label diario
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import DEFAULT_DB, backup_db, connect, default_backup_dir, human_size, rotate  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Backup do banco do Kortex com rotação.")
    ap.add_argument("--db", type=Path, default=DEFAULT_DB, help="banco de origem (padrão: data/kortex.db)")
    ap.add_argument("--out", type=Path, help="pasta de destino (padrão: data/backups)")
    ap.add_argument("--label", default="script", help="rótulo no nome do arquivo (padrão: script)")
    ap.add_argument("--keep", type=int, default=14, help="quantos backups deste rótulo manter (0 = todos)")
    args = ap.parse_args(argv)

    if not args.label.replace("-", "").isalnum():
        ap.error("--label aceita só letras, números e hífen")
    out = args.out or default_backup_dir(args.db)

    conn = connect(args.db)
    try:
        dest = backup_db(conn, out, args.label)
    finally:
        conn.close()
    print(f"✔ Backup criado: {dest} ({human_size(dest.stat().st_size)})")

    if args.keep > 0:
        for f in rotate(out, args.label, args.keep):
            print(f"  removido (rotação): {f.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
