#!/usr/bin/env bash
# Startet einen lokalen Webserver für Marie-dle (ES-Module laufen nicht über file://).
cd "$(dirname "$0")"
PORT="${1:-8000}"
echo "Marie-dle läuft auf http://localhost:$PORT  (Strg+C zum Beenden)"
python3 -m http.server "$PORT"
