"""Serve the Mosslight game and its small persistent leaderboard."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
SCORES_FILE = ROOT / "scores.json"
MAX_BODY_SIZE = 2_048
MAX_SCORES = 10


def read_scores() -> list[dict[str, object]]:
    try:
        data = json.loads(SCORES_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("Could not read the leaderboard.") from error

    if not isinstance(data, list):
        raise RuntimeError("The leaderboard data is invalid.")
    return [
        entry
        for entry in data
        if isinstance(entry, dict)
        and isinstance(entry.get("name"), str)
        and isinstance(entry.get("score"), int)
    ][:MAX_SCORES]


class GameHandler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        request_path = urlparse(self.path).path
        if request_path == "/api/scores":
            try:
                self.send_json(200, {"scores": read_scores()})
            except RuntimeError as error:
                self.send_json(500, {"error": str(error)})
            return

        files = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/static/styles.css": ("styles.css", "text/css; charset=utf-8"),
            "/static/game.js": ("game.js", "text/javascript; charset=utf-8"),
        }
        file_info = files.get(request_path)
        if file_info is None:
            self.send_error(404, "Not found")
            return

        filename, content_type = file_info
        try:
            body = (STATIC / filename).read_bytes()
        except OSError:
            self.send_error(500, "Could not read game file")
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/scores":
            self.send_error(404, "Not found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Invalid request length."})
            return
        if not 0 < content_length <= MAX_BODY_SIZE:
            self.send_json(413, {"error": "Request is too large or empty."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid JSON."})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {"error": "Expected a score object."})
            return

        name = payload.get("name")
        score = payload.get("score")
        if (
            not isinstance(name, str)
            or not name.strip()
            or len(name.strip()) > 16
            or not isinstance(score, int)
            or isinstance(score, bool)
            or not 0 <= score <= 100_000
        ):
            self.send_json(400, {"error": "Enter a name and a valid score."})
            return

        try:
            scores = read_scores()
            scores.append({"name": name.strip(), "score": score})
            scores.sort(key=lambda entry: int(entry["score"]), reverse=True)
            scores = scores[:MAX_SCORES]
            SCORES_FILE.write_text(
                json.dumps(scores, indent=2) + "\n", encoding="utf-8"
            )
        except (OSError, RuntimeError) as error:
            self.send_json(500, {"error": f"Could not save score: {error}"})
            return
        self.send_json(201, {"scores": scores})

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}")


if __name__ == "__main__":
    address = ("127.0.0.1", 8000)
    print(f"Mosslight is ready at http://{address[0]}:{address[1]}")
    ThreadingHTTPServer(address, GameHandler).serve_forever()
