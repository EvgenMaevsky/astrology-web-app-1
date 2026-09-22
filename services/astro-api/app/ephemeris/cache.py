"""Bounded in-memory cache for ephemeris results.

Identical birth data always yields an identical chart, and the astronomy is
by far the whole cost: calc_natal measures ~19.4 ms while a deep copy of its
result is ~0.04 ms, so a hit is roughly 480x cheaper than a miss.

Two deliberate design points, both of which are easy to get wrong:

1. **Copies in and out, never the stored object.** Downstream code mutates
   the result in place — add_terms_to_planets() writes a "term_ruler" key
   into every planet dict. Handing out the cached object itself would let
   one request's mutations leak into the next, which does not crash; it
   silently returns wrong charts, which is far worse.

2. **Only the raw astronomical result is cached**, never a finished
   response. Aspects, terms and Arabic parts cost 0.14 ms together, so
   recomputing them per request is free — and it keeps anything
   plan-dependent (Pro's minor aspects, for one) out of the cache entirely,
   so a Free-shaped response can never be served to a Pro user or the
   reverse.

The cache lives in the process and dies with it. That is on purpose: keys
are derived from dates and places of birth, which is personal data that has
no business in a shared or persistent store.
"""
import copy
import threading
from collections import OrderedDict
from typing import Any, Hashable


class ResultCache:
    def __init__(self, maxsize: int) -> None:
        self._maxsize = maxsize
        self._data: "OrderedDict[Hashable, Any]" = OrderedDict()
        # Calculations run in a thread pool, so entries can be read and
        # written concurrently.
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: Hashable) -> Any | None:
        with self._lock:
            if key not in self._data:
                self.misses += 1
                return None
            self._data.move_to_end(key)
            value = self._data[key]
            self.hits += 1
        return copy.deepcopy(value)

    def put(self, key: Hashable, value: Any) -> None:
        # Copy on the way in too: the caller mutates what it was given.
        stored = copy.deepcopy(value)
        with self._lock:
            self._data[key] = stored
            self._data.move_to_end(key)
            while len(self._data) > self._maxsize:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
            self.hits = 0
            self.misses = 0

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)
