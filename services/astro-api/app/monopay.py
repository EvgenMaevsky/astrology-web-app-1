import base64
import logging

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePublicKey

from app.config import settings

log = logging.getLogger(__name__)

BASE_URL = "https://api.monobank.ua"

_pubkey_cache: EllipticCurvePublicKey | None = None


async def create_invoice(
    amount_kopecks: int, reference: str, destination: str,
    redirect_url: str, webhook_url: str,
) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f"{BASE_URL}/api/merchant/invoice/create",
            headers={"X-Token": settings.monopay_token},
            json={
                "amount": amount_kopecks,
                "ccy": 980,
                "redirectUrl": redirect_url,
                "webHookUrl": webhook_url,
                "validity": 3600,
                "merchantPaymInfo": {"reference": reference, "destination": destination},
            },
        )
        r.raise_for_status()
        return r.json()


async def get_invoice_status(invoice_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{BASE_URL}/api/merchant/invoice/status",
            headers={"X-Token": settings.monopay_token},
            params={"invoiceId": invoice_id},
        )
        r.raise_for_status()
        return r.json()


async def _fetch_pubkey(force_refresh: bool = False) -> EllipticCurvePublicKey:
    global _pubkey_cache
    if _pubkey_cache is not None and not force_refresh:
        return _pubkey_cache

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{BASE_URL}/api/merchant/pubkey",
            headers={"X-Token": settings.monopay_token},
        )
        r.raise_for_status()
        pem = base64.b64decode(r.json()["key"])

    key = serialization.load_pem_public_key(pem)
    if not isinstance(key, EllipticCurvePublicKey):
        raise ValueError("monopay pubkey is not an EC public key")
    _pubkey_cache = key
    return key


async def verify_webhook_signature(raw_body: bytes, x_sign_b64: str) -> bool:
    try:
        signature = base64.b64decode(x_sign_b64)
    except Exception:
        return False

    for force_refresh in (False, True):
        key = await _fetch_pubkey(force_refresh=force_refresh)
        try:
            key.verify(signature, raw_body, ec.ECDSA(hashes.SHA256()))
            return True
        except InvalidSignature:
            # mono rotates signing keys occasionally — one retry with a
            # freshly fetched key before giving up.
            continue
    return False
