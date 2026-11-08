"""Utilitários compartilhados pelos scripts do Kortex (somente biblioteca padrão).

O formato JSON e a ordem das tabelas são os mesmos da API
(apps/api/src/modules/backup/service.ts): um backup feito pelo app pode ser
restaurado por estes scripts e vice-versa.
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Saída em UTF-8 mesmo quando redirecionada (no Windows, um pipe usa cp1252 e
# caracteres fora dele derrubariam o script). "replace" garante que nunca quebra.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = Path(os.environ.get("KORTEX_DB_PATH", ROOT / "data" / "kortex.db"))

BACKUP_FORMAT = "kortex-backup"
BACKUP_VERSION = 1

# Pais antes de filhos (chaves estrangeiras). Tabelas novas entram no fim.
FK_ORDER = [
    "settings",
    "tags",
    "projects",
    "ideas",
    "entity_tags",
    "reminder_categories",
    "reminders",
    "reminder_completions",
    "finance_activities",
    "finance_entries",
    "study_subjects",
    "time_entries",
    "workouts",
    "meal_plan",
    "meal_logs",
    "daily_goals",
    "goal_checks",
]


def default_backup_dir(db: Path) -> Path:
    return Path(os.environ.get("KORTEX_BACKUP_DIR", db.parent / "backups"))


def connect(db: Path) -> sqlite3.Connection:
    if not db.exists():
        raise SystemExit(f"Banco não encontrado: {db}")
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def data_tables(conn: sqlite3.Connection) -> list[str]:
    names = [
        r[0]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' "
            "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'"
        )
    ]
    known = [t for t in FK_ORDER if t in names]
    return known + sorted(n for n in names if n not in FK_ORDER)


def columns_of(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r[1] for r in conn.execute(f'PRAGMA table_info("{table}")')]


def schema_version(conn: sqlite3.Connection) -> int:
    try:
        return conn.execute("SELECT count(*) FROM __drizzle_migrations").fetchone()[0]
    except sqlite3.Error:
        return 0


def export_dict(conn: sqlite3.Connection) -> dict[str, Any]:
    """Mesmo formato de GET /api/export?format=json."""
    return {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "exportedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "schemaVersion": schema_version(conn),
        "tables": {
            t: [dict(r) for r in conn.execute(f'SELECT * FROM "{t}"')] for t in data_tables(conn)
        },
    }


def stamp() -> str:
    """2026-11-08_20-41-18-123 (UTC, igual à API)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S-%f")[:23]


def backup_db(conn: sqlite3.Connection, out_dir: Path, label: str) -> Path:
    """Cópia consistente via API de backup do SQLite (segura com o app rodando)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    base = f"kortex-{label}-{stamp()}"
    dest = out_dir / f"{base}.db"
    i = 2
    while dest.exists():
        dest = out_dir / f"{base}-{i}.db"
        i += 1
    with sqlite3.connect(dest) as target:
        conn.backup(target)
    target.close()
    return dest


def rotate(out_dir: Path, label: str, keep: int) -> list[Path]:
    """Apaga os backups mais antigos de um rótulo, mantendo `keep`."""
    files = sorted(out_dir.glob(f"kortex-{label}-*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    removed = files[keep:]
    for f in removed:
        f.unlink(missing_ok=True)
    return removed


def to_sql_value(v: Any) -> Any:
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v


def human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n} B"
