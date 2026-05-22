from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.person import Person
from app.models.user import User
from app.schemas.person import PersonCreate, PersonOut, PersonUpdate

router = APIRouter(prefix="/api/v1/persons", tags=["persons"])


@router.get("", response_model=list[PersonOut])
async def list_persons(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Person]:
    result = await db.execute(
        select(Person)
        .where(Person.user_id == current_user.id)
        .order_by(Person.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/count")
async def count_persons(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(func.count()).where(Person.user_id == current_user.id).select_from(Person)
    )
    return {"count": result.scalar_one()}


@router.post("", response_model=PersonOut, status_code=status.HTTP_201_CREATED)
async def create_person(
    body: PersonCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Person:
    person = Person(user_id=current_user.id, **body.model_dump())
    db.add(person)
    await db.commit()
    await db.refresh(person)
    return person


@router.get("/{person_id}", response_model=PersonOut)
async def get_person(
    person_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Person:
    person = await _get_owned(person_id, current_user.id, db)
    return person


@router.put("/{person_id}", response_model=PersonOut)
async def update_person(
    person_id: str,
    body: PersonUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Person:
    person = await _get_owned(person_id, current_user.id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(person, field, value)
    await db.commit()
    await db.refresh(person)
    return person


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_person(
    person_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    person = await _get_owned(person_id, current_user.id, db)
    await db.delete(person)
    await db.commit()


async def _get_owned(person_id: str, user_id: str, db: AsyncSession) -> Person:
    result = await db.execute(
        select(Person).where(Person.id == person_id, Person.user_id == user_id)
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person
