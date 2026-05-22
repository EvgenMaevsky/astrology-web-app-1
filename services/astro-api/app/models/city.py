from sqlalchemy import Column, Float, Index, Integer, String, Text
from app.database import Base


class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    ascii_name = Column(String, nullable=False)
    country = Column(String(2), nullable=False)
    region = Column(String)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    timezone = Column(String, nullable=False)
    population = Column(Integer, default=0)
