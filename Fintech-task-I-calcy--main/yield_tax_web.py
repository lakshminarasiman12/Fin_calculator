"""Local web server exposing the yield engine to the browser dashboard."""

import json
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from yield_tax_engine import YieldAndTaxEngine


HOST = "127.0.0.1"
PORT = 8765
WEB_ROOT = Path(__file__).parent / "web"
RATES_AS_OF = "2026-10-27"
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
}


@lru_cache(maxsize=128)
def _calculate_cached(
    principal: float,
    years: float,
    is_senior_citizen: bool,
    selected_product: str | None,
    pan_provided: bool,
) -> tuple[list[dict[str, float | str]], dict[str, str | float]]:
    engine = YieldAndTaxEngine()
    outcomes = engine.process_investment(
        principal, years, is_senior_citizen, selected_product
    )
    report = engine.generate_recommendation(
        outcomes,
        years,
        is_senior_citizen=is_senior_citizen,
        pan_provided=pan_provided,
    )
    return outcomes, report


class YieldTaxRequestHandler(BaseHTTPRequestHandler):
    """Serve the dashboard and its local JSON calculation endpoint."""

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path not in STATIC_FILES:
            self.send_error(404, "Resource not found.")
            return

        filename, content_type = STATIC_FILES[path]
        content = (WEB_ROOT / filename).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/calculate":
            self.send_error(404, "Resource not found.")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 16_384:
                raise ValueError("Request body must be between 1 and 16,384 bytes.")
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object.")

            principal = YieldAndTaxEngine._positive_number(
                payload.get("principal"), "principal"
            )
            years = YieldAndTaxEngine._positive_number(payload.get("years"), "years")
            senior = payload.get("is_senior_citizen")
            pan_provided = payload.get("pan_provided")
            selected_product = payload.get("selected_product")
            if not isinstance(senior, bool):
                raise TypeError("is_senior_citizen must be True or False.")
            if not isinstance(pan_provided, bool):
                raise TypeError("pan_provided must be True or False.")
            if selected_product is not None and not isinstance(selected_product, str):
                raise TypeError("selected_product must be a product name or null.")
            outcomes, report = _calculate_cached(
                principal, years, senior, selected_product, pan_provided
            )
        except (json.JSONDecodeError, TypeError, ValueError) as error:
            self._send_json(400, {"error": str(error)})
            return

        self._send_json(
            200,
            {
                "outcomes": outcomes,
                "report": report,
                "rates_as_of": RATES_AS_OF,
            },
        )

    def _send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), YieldTaxRequestHandler)
    print(f"Yield & Tax Scanner available at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Yield & Tax Scanner server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
