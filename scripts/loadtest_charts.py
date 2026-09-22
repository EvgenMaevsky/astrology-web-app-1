"""Load harness for the chart endpoints (written for plan E5).

Measures the thing that actually matters: while chart calculations are in
flight, how long does an unrelated, trivial request take? That is what shows
whether CPU work is starving everything else — average chart latency alone
would hide it completely.

    python scripts/loadtest_charts.py <access_token> "label" [--vary]

--vary sends a distinct birth time and place with every request, which is
the worst case: nothing is served from the result cache.

Two things to get right when using this, both learned by getting them wrong:

* The account needs plan="pro", or the free daily quota stops the run long
  before any load is applied.
* RATE_LIMIT_ENABLED must be false, or the rate limiter is what you measure.
* The cache lives in the server process, so a second run over the same
  inputs reads it. Restart the server between cold-start comparisons.
"""
import asyncio
import sys
import time

import httpx

BASE = "http://127.0.0.1:8000"
NATAL = {
    "birth_dt": "1990-01-01T12:00:00",
    "timezone": "Europe/Kyiv",
    "lat": 50.45,
    "lon": 30.52,
}


def pct(values, p):
    if not values:
        return float("nan")
    s = sorted(values)
    k = min(int(len(s) * p / 100), len(s) - 1)
    return s[k]


async def chart_worker(client, token, worker_id, n, out, vary):
    for i in range(n):
        body = dict(NATAL)
        if vary:
            # A distinct input for EVERY request, not merely per worker — an
            # earlier version varied per worker, which left an 87% cache hit
            # rate and made the worst case look like the best one.
            minute = worker_id * 17 + i
            body["birth_dt"] = (
                f"19{50 + (minute % 45):02d}-"
                f"{minute % 12 + 1:02d}-{minute % 28 + 1:02d}T"
                f"{minute % 24:02d}:{minute % 60:02d}:00"
            )
            body["lat"] = 50.45 + minute * 0.013
            body["lon"] = 30.52 + minute * 0.017
        t = time.perf_counter()
        r = await client.post(
            f"{BASE}/api/v1/charts/natal", json=body,
            headers={"Authorization": f"Bearer {token}"},
        )
        elapsed = (time.perf_counter() - t) * 1000
        if r.status_code == 200:
            out.append(elapsed)
        else:
            out.append(-r.status_code)


async def health_poller(client, out, stop):
    while not stop.is_set():
        t = time.perf_counter()
        try:
            await client.get(f"{BASE}/health")
            out.append((time.perf_counter() - t) * 1000)
        except Exception:
            pass
        await asyncio.sleep(0.02)


async def main(token, label, vary=False, concurrency=8, per_worker=8):
    async with httpx.AsyncClient(timeout=60) as client:
        # Warm up: the first call loads the ephemeris kernel.
        await client.post(f"{BASE}/api/v1/charts/natal", json=NATAL,
                          headers={"Authorization": f"Bearer {token}"})

        # Idle baseline for /health, for comparison against the loaded case.
        idle = []
        for _ in range(20):
            t = time.perf_counter()
            await client.get(f"{BASE}/health")
            idle.append((time.perf_counter() - t) * 1000)

        chart_times, health_times = [], []
        stop = asyncio.Event()
        poller = asyncio.create_task(health_poller(client, health_times, stop))

        started = time.perf_counter()
        await asyncio.gather(*[
            chart_worker(client, token, i, per_worker, chart_times, vary)
            for i in range(concurrency)
        ])
        wall = time.perf_counter() - started
        stop.set()
        await poller

        ok = [v for v in chart_times if v > 0]
        bad = [v for v in chart_times if v < 0]

        print(f"\n===== {label} =====")
        print(f"charts: {len(ok)} ok, {len(bad)} failed, wall {wall:.2f}s "
              f"=> {len(ok) / wall:.1f} charts/s")
        if ok:
            print(f"  chart latency  p50 {pct(ok,50):7.0f} ms  p95 {pct(ok,95):7.0f} ms")
        print(f"  /health IDLE   p50 {pct(idle,50):7.1f} ms  p95 {pct(idle,95):7.1f} ms")
        print(f"  /health LOADED p50 {pct(health_times,50):7.1f} ms  "
              f"p95 {pct(health_times,95):7.1f} ms  max {max(health_times or [0]):7.1f} ms"
              f"   (n={len(health_times)})")
        if bad:
            print(f"  failures: {sorted({-v for v in bad})}")


if __name__ == "__main__":
    token = sys.argv[1]
    label = sys.argv[2] if len(sys.argv) > 2 else "run"
    vary = "--vary" in sys.argv
    asyncio.run(main(token, label, vary=vary))
