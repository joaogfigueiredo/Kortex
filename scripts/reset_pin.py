#!/usr/bin/env python3
"""Remove o PIN do Kortex (para quem esqueceu).

Apaga só o PIN e as sessões abertas (chaves pin_hash, pin_numeric e
session_secret da tabela settings). Todos os seus dados continuam intactos.
Depois é só abrir o Kortex e criar um PIN novo em Configurações → Segurança.

    npm run reset-pin
    python scripts/reset_pin.py --yes
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import DEFAULT_DB, connect  # noqa: E402

PIN_KEYS = ("pin_hash", "pin_numeric", "session_secret")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Remove o PIN do Kortex sem tocar nos seus dados.")
    ap.add_argument("--db", type=Path, default=DEFAULT_DB, help="banco (padrão: data/kortex.db)")
    ap.add_argument("--yes", "-y", action="store_true", help="não pedir confirmação")
    args = ap.parse_args(argv)

    conn = connect(args.db)
    try:
        has_pin = conn.execute("SELECT 1 FROM settings WHERE key = 'pin_hash'").fetchone() is not None
        if not has_pin:
            print("[ok] Este Kortex já está sem PIN. Nada a fazer.")
            return 0
        if not args.yes:
            ans = input("Remover o PIN? Seus dados não serão apagados. [s/N] ")
            if ans.strip().lower() not in ("s", "sim", "y", "yes"):
                print("Cancelado.")
                return 1
        conn.execute(f"DELETE FROM settings WHERE key IN ({','.join('?' for _ in PIN_KEYS)})", PIN_KEYS)
        conn.commit()
    finally:
        conn.close()
    print("[ok] PIN removido. Abra o Kortex e crie um novo em Configurações → Segurança.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
