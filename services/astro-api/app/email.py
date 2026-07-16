import logging

import httpx

from app.config import settings

log = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send via Resend. With no API key (dev/tests) — log and pretend success."""
    if not settings.resend_api_key:
        log.info("EMAIL (dev, not sent) to=%s subject=%r body:\n%s", to, subject, html)
        return True
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from, "to": [to],
                "subject": subject, "html": html,
            },
        )
    if r.status_code >= 400:
        log.error("Resend error %s: %s", r.status_code, r.text[:300])
        return False
    return True
