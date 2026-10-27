"""Vercel serverless endpoint for the Yield & Tax Scanner."""
import json
from http.server import BaseHTTPRequestHandler
from datetime import date

from yield_tax_engine import YieldAndTaxEngine

RATES_AS_OF = "2026-10-27"


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path.split("?")[0] != "/api/calculate":
            self._send_json(404, {"error": "Endpoint not found."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 16384:
                raise ValueError("Request body must be between 1 and 16,384 bytes.")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object.")

            principal = YieldAndTaxEngine._positive_number(payload.get("principal"), "principal")
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

            engine = YieldAndTaxEngine()
            outcomes = engine.process_investment(principal, years, senior, selected_product)
            report = engine.generate_recommendation(
                outcomes, years, is_senior_citizen=senior, pan_provided=pan_provided
            )
            self._send_json(200, {
                "outcomes": outcomes,
                "report": report,
                "rates_as_of": RATES_AS_OF,
            })
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            self._send_json(400, {"error": str(exc)})
        except Exception:
            self._send_json(500, {"error": "An unexpected calculation error occurred."})

    def do_GET(self):
        self._send_json(405, {"error": "Use POST to calculate yields."})

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
