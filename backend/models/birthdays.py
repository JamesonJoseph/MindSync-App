"""
Birthday Management Schema and Validation
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re

class BirthdayBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    month: int = Field(..., ge=1, le=12)
    day: int = Field(..., ge=1, le=31)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    relation: str = Field(default="")
    color: str = Field(default="#FF6B6B")

class BirthdayCreate(BirthdayBase):
    @field_validator('month')
    @classmethod
    def validate_month(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("Month must be between 1 and 12")
        return v

    @field_validator('day')
    @classmethod
    def validate_day(cls, v: int) -> int:
        if not 1 <= v <= 31:
            raise ValueError("Day must be between 1 and 31")
        return v

class BirthdayResponse(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    month: int
    day: int
    year: Optional[int] = None
    relation: str
    color: str
    birthday_date: str
    created_at: datetime
    userId: str
    
    class Config:
        populate_by_name = True

def create_birthday_document(
    user_id: str,
    user_email: str,
    name: str,
    month: int,
    day: int,
    year: Optional[int],
    relation: str,
    color: str
) -> dict:
    now = datetime.now(timezone.utc)
    
    birthday_date = f"{month:02d}-{day:02d}"
    
    return {
        "userId": user_id,
        "userEmail": user_email,
        "name": name.strip(),
        "month": month,
        "day": day,
        "year": year,
        "relation": relation.strip(),
        "color": color,
        "birthday_date": birthday_date,
        "created_at": now,
        "updated_at": now
    }

def serialize_birthday_doc(doc: dict) -> dict:
    if not doc:
        return doc
    
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    
    if "created_at" in out and isinstance(out["created_at"], datetime):
        out["created_at"] = out["created_at"].isoformat()
    
    return out
