from fastapi import APIRouter, HTTPException, Query, Response

from app.interpretations import LANGUAGES, load

router = APIRouter(prefix="/api/v1/interpretations", tags=["interpretations"])

# A natal chart needs ~60-90 keys; this only stops a request asking for the
# whole corpus in one go.
MAX_KEYS = 200


@router.get("")
async def get_interpretations(
    response: Response,
    keys: str = Query(..., description="Comma-separated interpretation keys"),
    lang: str = "uk",
) -> dict[str, dict[str, str]]:
    """Texts for the given keys. Public: the texts are the same for everyone,
    and which keys a chart shows is decided by what the chart already
    contains (minor aspects only reach Pro users). Unknown keys are skipped.
    """
    if lang not in LANGUAGES:
        raise HTTPException(status_code=422, detail=f"lang must be one of {', '.join(LANGUAGES)}")
    wanted = [k for k in dict.fromkeys(keys.split(",")) if k]
    if len(wanted) > MAX_KEYS:
        raise HTTPException(status_code=422, detail=f"At most {MAX_KEYS} keys per request")
    texts = load(lang)
    # Texts change only on deploy.
    response.headers["Cache-Control"] = "public, max-age=3600"
    return {k: texts[k] for k in wanted if k in texts}
