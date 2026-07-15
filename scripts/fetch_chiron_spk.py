"""
Download an SPK ephemeris file for 2060 Chiron from JPL Horizons (free).

Run once:  python scripts/fetch_chiron_spk.py
Then set   CHIRON_SPK=./skyfield-data/chiron.bsp   in services/astro-api/.env
"""
import base64
import json
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent.parent / "services" / "astro-api" / "skyfield-data" / "chiron.bsp"

URL = (
    "https://ssd.api.jpl.nasa.gov/api/horizons.api"
    "?format=json&COMMAND='DES%3D2060%3B'&OBJ_DATA=NO&MAKE_EPHEM=YES"
    "&EPHEM_TYPE=SPK&START_TIME='1900-01-01'&STOP_TIME='2099-12-31'"
)


def main() -> None:
    print("Requesting Chiron SPK from JPL Horizons…", flush=True)
    with urllib.request.urlopen(URL, timeout=180) as r:
        payload = json.load(r)
    if "spk" not in payload:
        raise SystemExit(f"Horizons did not return an SPK: {payload.get('result', payload)[:500]}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(base64.b64decode(payload["spk"]))
    print(f"Saved {OUT} ({OUT.stat().st_size // 1024} KB)")
    print("Add to services/astro-api/.env:  CHIRON_SPK=./skyfield-data/chiron.bsp")


if __name__ == "__main__":
    main()
