#!/usr/bin/env python3
"""Exporta todos os dados do Kortex para JSON ou CSV.

- JSON: um arquivo no mesmo formato do botão "Exportar JSON" do app
  (pode ser restaurado com restore.py ou pelo próprio app).
- CSV: um .zip com um CSV por tabela (UTF-8 com BOM, abre certo no Excel)
  e um manifest.json com a contagem de linhas.

Exemplos:
    python scripts/export.py                       # JSON em ./kortex-backup-AAAA-MM-DD.json
    python scripts/export.py --format csv
    python scripts/export.py --out D:/exports/kortex.json
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import zipfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import DEFAULT_DB, columns_of, connect, data_tables, export_dict, human_size, schema_version  # noqa: E402


def export_json(conn, out: Path) -> dict[str, int]:
    data = export_dict(conn)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {t: len(rows) for t, rows in data["tables"].items()}


def export_csv(conn, out: Path) -> dict[str, int]:
    counts: dict[str, int] = {}
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for t in data_tables(conn):
            cols = columns_of(conn, t)
            buf = io.StringIO()
            w = csv.writer(buf, lineterminator="\r\n")
            w.writerow(cols)
            n = 0
            for row in conn.execute(f'SELECT * FROM "{t}"'):
                w.writerow(["" if row[c] is None else row[c] for c in cols])
                n += 1
            z.writestr(f"{t}.csv", buf.getvalue().encode("utf-8-sig"))
            counts[t] = n
        z.writestr(
            "manifest.json",
            json.dumps(
                {"format": "kortex-csv", "schemaVersion": schema_version(conn), "rows": counts},
                ensure_ascii=False,
                indent=2,
            ),
        )
    return counts


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Exporta os dados do Kortex para JSON ou CSV (zip).")
    ap.add_argument("--db", type=Path, default=DEFAULT_DB, help="banco (padrão: data/kortex.db)")
    ap.add_argument("--format", choices=["json", "csv"], default="json")
    ap.add_argument("--out", type=Path, help="arquivo de saída")
    args = ap.parse_args(argv)

    today = date.today().isoformat()
    out = args.out or Path(f"kortex-backup-{today}.json" if args.format == "json" else f"kortex-csv-{today}.zip")
    out.parent.mkdir(parents=True, exist_ok=True)

    conn = connect(args.db)
    try:
        counts = export_json(conn, out) if args.format == "json" else export_csv(conn, out)
    finally:
        conn.close()

    total = sum(counts.values())
    print(f"[ok] Exportado: {out} ({human_size(out.stat().st_size)}, {total} registros em {len(counts)} tabelas)")
    for t, n in counts.items():
        if n:
            print(f"  {t}: {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
