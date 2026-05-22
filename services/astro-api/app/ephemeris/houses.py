"""
House cusp calculations for Placidus, Koch, Equal, Whole Sign, and Regiomontanus.
All angles in degrees. Latitude in degrees (negative = south).
"""
import math


def _norm(deg: float) -> float:
    """Normalize angle to [0, 360)."""
    return deg % 360


def _obliquity(jd: float) -> float:
    """Mean obliquity of the ecliptic (IAU 2006), degrees."""
    T = (jd - 2451545.0) / 36525.0
    eps = (84381.406
           - 46.836769 * T
           - 0.0001831 * T ** 2
           + 0.00200340 * T ** 3) / 3600.0
    return eps


def get_mc(ramc: float, obl: float) -> float:
    """Ecliptic longitude of the Midheaven (MC)."""
    ramc_r = math.radians(ramc)
    obl_r = math.radians(obl)
    mc = math.degrees(math.atan2(math.tan(ramc_r), math.cos(obl_r)))
    # atan2 returns (-180, 180]; adjust to match RAMC quadrant
    if ramc < 180:
        mc = _norm(mc)
        if mc > 180:
            mc -= 180
    else:
        mc = _norm(mc)
        if mc < 180:
            mc += 180
    return _norm(mc)


def get_asc(ramc: float, obl: float, lat: float) -> float:
    """Ecliptic longitude of the Ascendant."""
    ramc_r = math.radians(ramc)
    obl_r = math.radians(obl)
    lat_r = math.radians(lat)
    y = math.cos(ramc_r)
    x = -(math.sin(ramc_r) * math.cos(obl_r) + math.tan(lat_r) * math.sin(obl_r))
    asc = math.degrees(math.atan2(y, x))
    return _norm(asc)


def _ecliptic_decl(lon: float, obl: float) -> float:
    """Declination of a point on the ecliptic."""
    return math.degrees(math.asin(math.sin(math.radians(obl)) * math.sin(math.radians(lon))))


def _asc_diff(lon: float, obl: float, lat: float) -> float:
    """Ascensional difference (semi-arc adjustment for Placidus)."""
    decl = _ecliptic_decl(lon, obl)
    arg = math.tan(math.radians(lat)) * math.tan(math.radians(decl))
    arg = max(-1.0, min(1.0, arg))  # clamp for circumpolar bodies
    return math.degrees(math.asin(arg))


def _ra_of_lon(lon: float, obl: float) -> float:
    """Right Ascension of an ecliptic longitude."""
    lon_r = math.radians(lon)
    obl_r = math.radians(obl)
    ra = math.degrees(math.atan2(math.sin(lon_r) * math.cos(obl_r), math.cos(lon_r)))
    return _norm(ra)


def _placidus_cusp(target_oa: float, obl: float, lat: float, above: bool) -> float:
    """
    Iterative Placidus cusp: find ecliptic longitude λ such that
    OA(λ) ± AscDiff(λ) = target_oa.
    above=True for houses 11,12 (diurnal semi-arc), False for 2,3 (nocturnal).
    """
    lon = _norm(target_oa)
    for _ in range(50):
        ra = _ra_of_lon(lon, obl)
        ad = _asc_diff(lon, obl, lat)
        if above:
            new_lon = _norm(target_oa - ad)
        else:
            new_lon = _norm(target_oa + ad)
        if abs(_norm(new_lon - lon + 180) - 180) < 1e-9:
            break
        lon = new_lon
    return _norm(lon)


def placidus(ramc: float, obl: float, lat: float) -> list[float]:
    """
    Return 12 house cusps [H1..H12] in ecliptic degrees, Placidus system.
    H1 = ASC, H10 = MC.
    """
    mc = get_mc(ramc, obl)
    asc = get_asc(ramc, obl, lat)

    # Upper houses: 11 = RAMC+30, 12 = RAMC+60 (diurnal semi-arc, above horizon)
    h11 = _placidus_cusp(_norm(ramc + 30), obl, lat, above=True)
    h12 = _placidus_cusp(_norm(ramc + 60), obl, lat, above=True)

    # Lower houses: 2 = RAMC+120, 3 = RAMC+150 (nocturnal semi-arc)
    h2 = _placidus_cusp(_norm(ramc + 120), obl, lat, above=False)
    h3 = _placidus_cusp(_norm(ramc + 150), obl, lat, above=False)

    # Opposite axes
    h4 = _norm(mc + 180)
    h7 = _norm(asc + 180)
    h5 = _norm(h11 + 180)
    h6 = _norm(h12 + 180)
    h8 = _norm(h2 + 180)
    h9 = _norm(h3 + 180)

    return [asc, h2, h3, h4, h5, h6, h7, h8, h9, mc, h11, h12]


def equal(ramc: float, obl: float, lat: float) -> list[float]:
    """Equal house system: 12 houses of exactly 30° each, starting from ASC."""
    asc = get_asc(ramc, obl, lat)
    return [_norm(asc + i * 30) for i in range(12)]


def whole_sign(ramc: float, obl: float, lat: float) -> list[float]:
    """Whole sign houses: each house occupies a full zodiac sign."""
    asc = get_asc(ramc, obl, lat)
    asc_sign_start = (int(asc / 30)) * 30.0
    return [_norm(asc_sign_start + i * 30) for i in range(12)]


def koch(ramc: float, obl: float, lat: float) -> list[float]:
    """Koch house system (Birthplace system). Approximate — trisects the MC–ASC arc."""
    mc = get_mc(ramc, obl)
    asc = get_asc(ramc, obl, lat)

    mc_r, asc_r = math.radians(mc), math.radians(asc)
    obl_r, lat_r = math.radians(obl), math.radians(lat)

    def _koch_cusp(fraction: float, upper: bool) -> float:
        if upper:
            target_ra = _norm(ramc + fraction * 90)
        else:
            target_ra = _norm(ramc + 90 + fraction * 90)
        return _placidus_cusp(target_ra, obl, lat, above=upper)

    h11 = _koch_cusp(1/3, upper=True)
    h12 = _koch_cusp(2/3, upper=True)
    h2 = _koch_cusp(1/3, upper=False)
    h3 = _koch_cusp(2/3, upper=False)

    h4 = _norm(mc + 180)
    h7 = _norm(asc + 180)
    h5 = _norm(h11 + 180)
    h6 = _norm(h12 + 180)
    h8 = _norm(h2 + 180)
    h9 = _norm(h3 + 180)

    return [asc, h2, h3, h4, h5, h6, h7, h8, h9, mc, h11, h12]


HOUSE_SYSTEMS: dict[str, callable] = {
    "placidus": placidus,
    "equal": equal,
    "whole_sign": whole_sign,
    "koch": koch,
}
