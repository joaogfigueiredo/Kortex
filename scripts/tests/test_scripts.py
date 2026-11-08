"""Testes dos scripts Python (somente biblioteca padrão).

Rodar:  python -m unittest discover -s scripts/tests -v
O banco de teste é criado a partir das migrations reais (apps/api/drizzle/*.sql).
"""

from __future__ import annotations

import csv
import io
import json
import sqlite3
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS))

import backup  # noqa: E402
import export  # noqa: E402
import restore  # noqa: E402
from _common import export_dict  # noqa: E402

MIGRATIONS = SCRIPTS.parent / "apps" / "api" / "drizzle"


def make_db(path: Path) -> None:
    conn = sqlite3.connect(path)
    for f in sorted(MIGRATIONS.glob("*.sql")):
        for stmt in f.read_text(encoding="utf-8").split("--> statement-breakpoint"):
            if stmt.strip():
                conn.execute(stmt)
    conn.execute("CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT, created_at NUMERIC)")
    conn.execute("INSERT INTO __drizzle_migrations (hash) VALUES ('x')")
    conn.executescript(
        """
        INSERT INTO projects (id, title, status, position) VALUES (1, 'Kortex', 'started', 1024);
        INSERT INTO ideas (id, title, status, priority, position, promoted_project_id)
          VALUES (1, 'Ideia, com "aspas"
e quebra', 'organized', 1, 1024, 1);
        INSERT INTO finance_activities (id, title, status, kind, position) VALUES (1, 'CLT', 'active', 'job', 1024);
        INSERT INTO finance_entries (activity_id, type, content, meta) VALUES (1, 'edit', 'x', '{"a":1}');
        INSERT INTO time_entries (module, ref_id, started_at, duration_sec) VALUES ('project', 1, '2026-11-08T10:00', 600);
        """
    )
    conn.commit()
    conn.close()


def snapshot(path: Path) -> dict:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    data = export_dict(conn)["tables"]
    conn.close()
    return data


class ScriptsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.db = self.dir / "kortex.db"
        make_db(self.db)

    def tearDown(self):
        self.tmp.cleanup()

    # ---------- backup.py ----------
    def test_backup_cria_copia_valida_e_faz_rotacao(self):
        out = self.dir / "bk"
        for _ in range(4):
            self.assertEqual(backup.main(["--db", str(self.db), "--out", str(out), "--keep", "2", "--label", "t"]), 0)
        files = sorted(out.glob("kortex-t-*.db"))
        self.assertEqual(len(files), 2)
        self.assertEqual(snapshot(files[-1]), snapshot(self.db))

    def test_backup_rejeita_rotulo_invalido(self):
        with self.assertRaises(SystemExit):
            backup.main(["--db", str(self.db), "--label", "../x"])

    # ---------- export.py ----------
    def test_export_json_no_formato_da_api(self):
        out = self.dir / "b.json"
        export.main(["--db", str(self.db), "--out", str(out)])
        data = json.loads(out.read_text(encoding="utf-8"))
        self.assertEqual((data["format"], data["version"], data["schemaVersion"]), ("kortex-backup", 1, 1))
        self.assertNotIn("__drizzle_migrations", data["tables"])
        self.assertEqual(data["tables"]["ideas"][0]["promoted_project_id"], 1)

    def test_export_csv_zip_com_bom_e_escape(self):
        out = self.dir / "c.zip"
        export.main(["--db", str(self.db), "--format", "csv", "--out", str(out)])
        with zipfile.ZipFile(out) as z:
            self.assertIn("manifest.json", z.namelist())
            raw = z.read("ideas.csv")
            self.assertTrue(raw.startswith(b"\xef\xbb\xbf"))
            rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
            self.assertEqual(rows[0]["title"], 'Ideia, com "aspas"\ne quebra')
            self.assertEqual(json.loads(z.read("manifest.json"))["rows"]["ideas"], 1)

    # ---------- restore.py ----------
    def test_restore_json_ida_e_volta(self):
        out = self.dir / "b.json"
        export.main(["--db", str(self.db), "--out", str(out)])
        before = snapshot(self.db)
        conn = sqlite3.connect(self.db)
        conn.execute("DELETE FROM time_entries")
        conn.execute("INSERT INTO ideas (title, status, priority, position) VALUES ('lixo', 'done', 2, 1)")
        conn.commit()
        conn.close()
        self.assertEqual(restore.main([str(out), "--db", str(self.db), "--yes"]), 0)
        self.assertEqual(snapshot(self.db), before)
        self.assertTrue(list((self.dir / "backups").glob("kortex-pre-restore-*.db")))

    def test_restore_json_quebrado_nao_altera_nada(self):
        out = self.dir / "b.json"
        export.main(["--db", str(self.db), "--out", str(out)])
        data = json.loads(out.read_text(encoding="utf-8"))
        data["tables"]["finance_entries"][0]["activity_id"] = 999
        data["tables"]["ideas"] = []
        out.write_text(json.dumps(data), encoding="utf-8")
        before = snapshot(self.db)
        self.assertEqual(restore.main([str(out), "--db", str(self.db), "--yes"]), 2)
        self.assertEqual(snapshot(self.db), before)
        conn = sqlite3.connect(self.db)
        conn.execute("PRAGMA foreign_keys = ON")
        self.assertEqual(conn.execute("PRAGMA foreign_keys").fetchone()[0], 1)
        conn.close()

    def test_restore_rejeita_formato_e_tabela_desconhecida(self):
        bad = self.dir / "x.json"
        bad.write_text('{"foo": 1}', encoding="utf-8")
        self.assertEqual(restore.main([str(bad), "--db", str(self.db), "--yes"]), 2)
        data = {"format": "kortex-backup", "version": 1, "tables": {"hackers": []}}
        bad.write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(restore.main([str(bad), "--db", str(self.db), "--yes"]), 2)

    def test_restore_de_arquivo_db(self):
        bk = self.dir / "bk"
        backup.main(["--db", str(self.db), "--out", str(bk), "--label", "t"])
        before = snapshot(self.db)
        conn = sqlite3.connect(self.db)
        conn.execute("DELETE FROM time_entries")
        conn.commit()
        conn.close()
        src = next(bk.glob("kortex-t-*.db"))
        self.assertEqual(restore.main([str(src), "--db", str(self.db), "--yes"]), 0)
        self.assertEqual(snapshot(self.db), before)


if __name__ == "__main__":
    unittest.main()
