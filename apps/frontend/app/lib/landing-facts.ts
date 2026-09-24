import { HOUSE_SYSTEMS } from "@/app/lib/house-systems";

/**
 * Numbers the landing page states as fact. Each one names its source,
 * because a trust section that overstates accuracy is worse than none.
 *
 * Values the frontend cannot import are mirrored here and guarded by
 * services/astro-api/tests/test_landing_facts.py, which fails if they drift
 * from the backend — the same lesson as the plan catalogue in E4, where the
 * sales copy promised things the code did not do because nothing compared
 * the two.
 */
export const LANDING_FACTS = {
  // services/astro-api/tests/test_cross_swisseph.py → PLANET_TOL
  precisionDeg: 0.003,
  // 34,146 cities after the GeoNames import; rounded DOWN on purpose.
  cities: 34000,
  houseSystems: HOUSE_SYSTEMS.length,
  // services/astro-api/app/schemas/chart.py → EPHEMERIS_MIN_YEAR / MAX_YEAR
  yearFrom: 1850,
  yearTo: 2149,
} as const;
