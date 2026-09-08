"""Exercise the actual embedded extractor uploader without accessing Messages."""
import contextlib
import io
import json
from pathlib import Path
import sys
import sqlite3
import time
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / "apps/web/public/imessage-ingest.sh"
SOURCE = SCRIPT.read_text().split("<<'PYEOF'\n", 1)[1].rsplit("\nPYEOF", 1)[0]
DECODER = SCRIPT.parent / "vendor/pytypedstream-0.1.0-py3-none-any.whl"
LIMIT = 4 * 1024 * 1024


def row(index, text):
    return {"id": f"guid-{index}", "chat_id": "chat-guid", "ts": "2026-09-01 12:00:00",
            "chat": "Friends", "sender": "Sam", "is_from_me": 0, "text": text}


class UploadTests(unittest.TestCase):
    def upload(self, rows, catalogue=None):
        requests = []
        def send(request):
            requests.append(request)
            return io.BytesIO(b'{"ok":true}')
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "rows.json"
            fixture.write_text(json.dumps(rows))
            arguments = ["uploader", str(fixture), "https://air.test/upload", "test-ticket", "365", str(DECODER)]
            if catalogue is not None:
                catalogue_path = Path(directory) / "catalogue.json"
                catalogue_path.write_text(json.dumps(catalogue))
                arguments.append(str(catalogue_path))
            with patch.object(sys, "argv", arguments), patch("urllib.request.urlopen", side_effect=send), contextlib.redirect_stdout(io.StringIO()):
                exec(compile(SOURCE, str(SCRIPT), "exec"), {})
        return requests

    def test_unicode_splits_by_bytes_preserving_all_rows_and_ids(self):
        rows = [row(i, "🧠" * 300000) for i in range(5)]
        requests = self.upload(rows)
        self.assertEqual(len(requests), 2)
        messages = []
        for request in requests:
            self.assertLessEqual(len(request.data), LIMIT)
            body = json.loads(request.data)
            self.assertEqual(body["from_date"], body["messages"][0]["ts"])
            self.assertEqual(body["to_date"], body["messages"][-1]["ts"])
            messages.extend(body["messages"])
        self.assertEqual([m["id"] for m in messages], [r["id"] for r in rows])
        self.assertEqual([m["text"] for m in messages], [r["text"] for r in rows])

    def test_count_limit_independent_of_byte_limit(self):
        requests = self.upload([row(i, "a") for i in range(20001)])
        self.assertEqual([len(json.loads(r.data)["messages"]) for r in requests], [20000, 1])
        self.assertTrue(all(len(r.data) <= LIMIT for r in requests))

    def test_catalogue_is_preserved_and_counted_in_every_upload(self):
        catalogue = [{"id": "thread-guid", "label": "🧠" * 100000}]
        requests = self.upload([row(i, "x" * 800000) for i in range(5)], catalogue)
        self.assertGreater(len(requests), 1)
        for request in requests:
            self.assertLessEqual(len(request.data), LIMIT)
            self.assertEqual(json.loads(request.data)["threads"], catalogue)

    def test_oversized_row_stops_before_any_request(self):
        with patch("urllib.request.Request") as request:
            with self.assertRaisesRegex(SystemExit, "nothing uploaded"):
                self.upload([row(0, "valid"), row(1, "x" * LIMIT)])
            request.assert_not_called()

    def test_actual_sql_and_uploader_include_plain_and_attributed_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            database = sqlite3.connect(str(Path(directory) / "chat.db"))
            database.row_factory = sqlite3.Row
            database.executescript("""
                CREATE TABLE message (guid TEXT, date INTEGER, handle_id INTEGER, is_from_me INTEGER, text TEXT, attributedBody BLOB);
                CREATE TABLE handle (id TEXT);
                CREATE TABLE chat (guid TEXT, display_name TEXT, chat_identifier TEXT);
                CREATE TABLE chat_message_join (message_id INTEGER, chat_id INTEGER);
                INSERT INTO handle VALUES ('Sam');
                INSERT INTO chat VALUES ('chat-guid', 'Friends', 'chat-identifier');
                INSERT INTO chat_message_join VALUES (1,1), (2,1);
            """)
            apple_date = int((time.time() - 978307200 - 3600) * 1000000000)
            blob = bytes.fromhex((Path(__file__).parent / "fixtures/attributed-body.hex").read_text())
            database.executemany("INSERT INTO message VALUES (?,?,?,?,?,?)", [
                ('plain-guid', apple_date, 1, 0, 'Plain text message', None),
                ('archive-guid', apple_date + 1, 1, 0, None, blob),
            ])
            query = SCRIPT.read_text().split('"file:$DB?mode=ro" "\n', 1)[1].split('\n" > "$TMP"', 1)[0].replace('${DAYS}', '365').replace('${SINCE_SECONDS}', '0')
            rows = [dict(result) for result in database.execute(query)]
            database.executescript("""
                INSERT INTO chat VALUES ('old-chat', 'Older friends', 'old-identifier');
                INSERT INTO message VALUES ('old-message', 0, 1, 0, 'Old text', NULL);
                INSERT INTO chat_message_join VALUES (3,2);
            """)
            catalogue_query = SCRIPT.read_text().split('"file:$DB?mode=ro" "\n')[2].split('\n" > "$CATALOGUE"', 1)[0]
            catalogue = [dict(result) for result in database.execute(catalogue_query)]
            self.assertIn({"id": "old-chat", "label": "Older friends"}, catalogue)
            boundary = apple_date // 1000000000 + 978307200
            boundary_query = query.replace('>= 0', f'>= {boundary}')
            self.assertEqual(len(database.execute(boundary_query).fetchall()), 2)
            self.assertEqual(len(database.execute(query.replace('>= 0', f'>= {boundary + 1}')).fetchall()), 0)
            database.close()
            uploaded = json.loads(self.upload(rows, catalogue)[0].data)["messages"]
            self.assertEqual([m["text"] for m in uploaded], ['Plain text message', 'Meet at Olive at 7. 🧠\nBring notes.'])
            self.assertEqual([m["id"] for m in uploaded], ['plain-guid', 'archive-guid'])

    def test_undecodable_body_prevents_partial_upload(self):
        with patch("urllib.request.Request") as request:
            with self.assertRaisesRegex(SystemExit, "could not be decoded"):
                self.upload([row(0, "valid"), {**row(1, ""), "attributed_body": "deadbeef"}])
            request.assert_not_called()

    def test_cursor_validates_timezone_and_emits_only_numeric_sql_data(self):
        source = SCRIPT.read_text().split("<<'CURSORPY'\n", 1)[1].split("\nCURSORPY", 1)[0]
        def run(value):
            return subprocess.run([sys.executable, "-c", source, value], capture_output=True, text=True)
        self.assertEqual(run("").stdout.strip(), "0")
        utc = run("2026-09-01T12:00:00Z")
        self.assertEqual(utc.returncode, 0)
        self.assertTrue(utc.stdout.strip().isdigit())
        self.assertEqual(utc.stdout, run("2026-09-01T13:00:00+01:00").stdout)
        for invalid in ("2026-09-01", "yesterday", "0; DROP TABLE message;", "1960-01-01T00:00:00Z"):
            result = run(invalid)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
