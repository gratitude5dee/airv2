"""Exercise the actual embedded extractor uploader without accessing Messages."""
import contextlib
import io
import json
from pathlib import Path
import socket
import sys
import sqlite3
import time
import subprocess
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / "apps/web/public/imessage-ingest.sh"
SOURCE = SCRIPT.read_text().split("<<'PYEOF'\n", 1)[1].rsplit("\nPYEOF", 1)[0]
DECODER = SCRIPT.parent / "vendor/pytypedstream-0.1.0-py3-none-any.whl"
LIMIT = 4 * 1024 * 1024


def row(index, text):
    return {"id": f"guid-{index}", "chat_id": "chat-guid", "ts": "2026-09-01 12:00:00",
            "chat": "Friends", "sender": "Sam", "is_from_me": 0, "text": text}


def failure(status, **body):
    """An HTTPError carrying the server's JSON failure envelope."""
    return urllib.error.HTTPError("https://air.test/upload", status, "error", {}, io.BytesIO(json.dumps(body).encode()))


class UploadTests(unittest.TestCase):
    def upload(self, rows, catalogue=None, responses=None):
        """Run the embedded uploader. `responses` scripts each POST in order: a
        dict is a 200 body, an exception is raised from urlopen; the default is
        a plain 200. Sleeps and stdout land on self._sleeps / self._stdout."""
        requests, sleeps, output = [], [], io.StringIO()
        scripted = list(responses or [])
        self._timeouts = []
        def send(request, timeout=None):
            requests.append(request)
            self._timeouts.append(timeout)
            response = scripted.pop(0) if scripted else {"ok": True}
            if isinstance(response, Exception):
                raise response
            return io.BytesIO(json.dumps(response).encode())
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "rows.json"
            fixture.write_text(json.dumps(rows))
            arguments = ["uploader", str(fixture), "https://air.test/upload", "test-ticket", "365", str(DECODER)]
            if catalogue is not None:
                catalogue_path = Path(directory) / "catalogue.json"
                catalogue_path.write_text(json.dumps(catalogue))
                arguments.append(str(catalogue_path))
            self._sleeps, self._stdout = sleeps, ""
            try:
                with patch.object(sys, "argv", arguments), patch("urllib.request.urlopen", side_effect=send), \
                     patch("time.sleep", side_effect=sleeps.append), contextlib.redirect_stdout(output), \
                     contextlib.redirect_stderr(io.StringIO()):
                    exec(compile(SOURCE, str(SCRIPT), "exec"), {})
            finally:
                self._stdout = output.getvalue()
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

    def test_retriable_failures_back_off_then_succeed_without_resending_committed_chunks(self):
        rows = [row(i, "🧠" * 300000) for i in range(5)]
        responses = [
            {"ok": True, "cursor": "2026-09-01T12:00:00.000Z"},
            failure(503, code="archive_busy", error="busy", retriable=True, retry_after_seconds=2),
            urllib.error.URLError("connection reset"),
            failure(502, error="gateway"),
            {"ok": True, "cursor": "2026-09-01T12:00:00.000Z"},
        ]
        requests = self.upload(rows, responses=responses)
        self.assertEqual(len(requests), 5)
        self.assertEqual(requests[1].data, requests[4].data)
        self.assertNotEqual(requests[0].data, requests[1].data)
        self.assertEqual(self._sleeps, [2.0, 4.0, 8.0])
        self.assertIn("Archive cursor: 2026-09-01T12:00:00.000Z", self._stdout)

    def test_terminal_failure_stops_with_code_and_cursor(self):
        rows = [row(i, "🧠" * 300000) for i in range(5)]
        responses = [
            {"ok": True, "cursor": "2026-09-01T12:00:00.000Z"},
            failure(400, code="invalid_chunk", error="Upload rejected: bad ts.", retriable=False),
        ]
        with self.assertRaisesRegex(SystemExit, r"(?s)stopped \(invalid_chunk\).*bad ts.*Archive cursor: 2026-09-01T12:00:00.000Z"):
            self.upload(rows, responses=responses)
        self.assertEqual(self._sleeps, [])

    def test_resolution_required_names_where_to_resolve_and_never_retries(self):
        responses = [failure(409, code="resolution_required", error="Some earlier chat labels match more than one conversation.",
                             retriable=False, resolve_at="https://air.test/api/me/imessage-history/resolutions")]
        with self.assertRaisesRegex(SystemExit, r"(?s)resolution_required.*https://air.test/api/me/imessage-history/resolutions"):
            self.upload([row(0, "hi")], responses=responses)
        self.assertEqual(self._sleeps, [])

    def test_stalled_server_times_out_and_retries_are_bounded(self):
        responses = [socket.timeout("timed out")] * 3 + [urllib.error.URLError(socket.timeout("timed out"))] * 20
        with self.assertRaisesRegex(SystemExit, r"stopped \(timeout\): no response within 180s \(gave up after 8 attempts\)"):
            self.upload([row(0, "hi")], responses=responses)
        self.assertEqual(self._timeouts, [180] * 8)
        self.assertEqual(self._sleeps, [2.0, 4.0, 8.0, 16.0, 32.0, 64.0, 120.0])

    def test_retries_are_bounded(self):
        responses = [failure(503, code="archive_busy", error="busy", retriable=True, retry_after_seconds=1) for _ in range(20)]
        with self.assertRaisesRegex(SystemExit, r"archive_busy.*gave up after 8 attempts"):
            self.upload([row(0, "hi")], responses=responses)
        self.assertEqual(self._sleeps, [1.0] * 7)

    def test_cursor_validates_timezone_and_emits_only_numeric_sql_data(self):
        source = SCRIPT.read_text().split("<<'CURSORPY'\n", 1)[1].split("\nCURSORPY", 1)[0]
        def run(value):
            return subprocess.run([sys.executable, "-c", source, value], capture_output=True, text=True)
        self.assertEqual(run("").stdout.strip(), "0")
        utc = run("2026-09-01T12:00:00Z")
        self.assertEqual(utc.returncode, 0)
        self.assertTrue(utc.stdout.strip().isdigit())
        self.assertEqual(utc.stdout, run("2026-09-01T13:00:00+01:00").stdout)
        self.assertEqual(utc.stdout, run("2026-09-01T12:00:00.000Z").stdout)
        for invalid in ("2026-09-01", "yesterday", "0; DROP TABLE message;", "1960-01-01T00:00:00Z"):
            result = run(invalid)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
