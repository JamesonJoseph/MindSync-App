"""
Task and Event Management System with Reminder Notifications

Features:
- Proper datetime handling using Python datetime objects (NOT strings)
- ISO 8601 format for storage and API responses
- Validation: reject past datetime, ensure reminder is before event
- Notification scheduling using timestamps
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator, computed_field
import re

class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    event_date: str = Field(..., description="Date in YYYY-MM-DD format")
    event_time: str = Field(..., description="Time in HH:MM format (24-hour)")
    reminder_minutes: int = Field(default=30, ge=1, le=10080, description="Minutes before event to remind (1 min to 1 week)")

class EventCreate(EventBase):
    @field_validator('event_date')
    @classmethod
    def validate_date(cls, v: str) -> str:
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', v):
            raise ValueError("Date must be in YYYY-MM-DD format")
        try:
            datetime.strptime(v, '%Y-%m-%d')
        except ValueError:
            raise ValueError("Invalid date")
        return v

    @field_validator('event_time')
    @classmethod
    def validate_time(cls, v: str) -> str:
        if not re.match(r'^\d{2}:\d{2}$', v):
            raise ValueError("Time must be in HH:MM format")
        try:
            datetime.strptime(v, '%H:%M')
        except ValueError:
            raise ValueError("Invalid time")
        return v

class EventResponse(BaseModel):
    id: str = Field(..., alias="_id")
    title: str
    event_datetime: datetime
    reminder_minutes: int
    reminder_datetime: datetime
    reminder_timestamp: int = Field(..., description="Unix timestamp for scheduling")
    event_timestamp: int = Field(..., description="Unix timestamp of event")
    created_at: datetime
    userId: str
    userEmail: Optional[str] = ""
    
    class Config:
        populate_by_name = True

class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    reminder_minutes: Optional[int] = Field(None, ge=1, le=10080)

def combine_date_time(date_str: str, time_str: str) -> datetime:
    naive_dt = datetime.strptime(f"{date_str}T{time_str}:00", "%Y-%m-%dT%H:%M:%S")
    return naive_dt.replace(tzinfo=timezone.utc)

def calculate_reminder(event_datetime: datetime, reminder_minutes: int) -> datetime:
    return event_datetime - timedelta(minutes=reminder_minutes)

def datetime_to_timestamp(dt: datetime) -> int:
    return int(dt.timestamp())

def is_past_datetime(dt: datetime) -> bool:
    return dt < datetime.now(timezone.utc)

def validate_event_data(
    title: str,
    event_date: str,
    event_time: str,
    reminder_minutes: int
) -> tuple[bool, str, Optional[datetime]]:
    if not title or not title.strip():
        return False, "Title is required", None
    
    event_datetime = combine_date_time(event_date, event_time)
    
    if is_past_datetime(event_datetime):
        return False, "Event datetime cannot be in the past", None
    
    reminder_datetime = calculate_reminder(event_datetime, reminder_minutes)
    
    if reminder_datetime <= datetime.now(timezone.utc):
        return False, "Reminder time cannot be in the past. Choose a smaller reminder interval.", None
    
    return True, "", event_datetime

def create_event_document(
    user_id: str,
    user_email: str,
    title: str,
    event_date: str,
    event_time: str,
    reminder_minutes: int
) -> dict:
    event_datetime = combine_date_time(event_date, event_time)
    reminder_datetime = calculate_reminder(event_datetime, reminder_minutes)
    now = datetime.now(timezone.utc)
    
    return {
        "userId": user_id,
        "userEmail": user_email,
        "title": title.strip(),
        "event_datetime": event_datetime,
        "reminder_minutes": reminder_minutes,
        "reminder_datetime": reminder_datetime,
        "reminder_timestamp": datetime_to_timestamp(reminder_datetime),
        "event_timestamp": datetime_to_timestamp(event_datetime),
        "created_at": now,
        "status": "pending",
        "notified": False
    }

def update_event_document(
    existing_doc: dict,
    title: Optional[str] = None,
    event_date: Optional[str] = None,
    event_time: Optional[str] = None,
    reminder_minutes: Optional[int] = None
) -> dict:
    updated = existing_doc.copy()
    
    if title is not None:
        updated["title"] = title.strip()
    
    if event_date is not None or event_time is not None:
        current_dt = updated.get("event_datetime")
        if current_dt is None:
            raise ValueError("Current event_datetime is required when updating date/time")
        date_to_use = event_date if event_date is not None else current_dt.strftime("%Y-%m-%d")
        time_to_use = event_time if event_time is not None else current_dt.strftime("%H:%M")
        
        event_datetime = combine_date_time(date_to_use, time_to_use)
        reminder_min = reminder_minutes if reminder_minutes is not None else updated.get("reminder_minutes", 30)
        
        updated["event_datetime"] = event_datetime
        updated["reminder_minutes"] = reminder_min
        updated["reminder_datetime"] = calculate_reminder(event_datetime, reminder_min)
        updated["reminder_timestamp"] = datetime_to_timestamp(updated["reminder_datetime"])
        updated["event_timestamp"] = datetime_to_timestamp(event_datetime)
    
    elif reminder_minutes is not None:
        event_datetime = updated.get("event_datetime")
        if event_datetime is None:
            raise ValueError("Current event_datetime is required when updating reminder")
        updated["reminder_minutes"] = reminder_minutes
        updated["reminder_datetime"] = calculate_reminder(event_datetime, reminder_minutes)
        updated["reminder_timestamp"] = datetime_to_timestamp(updated["reminder_datetime"])
    
    return updated

def serialize_event_doc(doc: dict) -> dict:
    if not doc:
        return doc
    
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    
    for field in ["event_datetime", "reminder_datetime", "created_at"]:
        if field in out and isinstance(out[field], datetime):
            out[field] = out[field].isoformat()
    
    return out

def get_upcoming_reminders(limit: int = 100) -> dict:
    now = datetime.now(timezone.utc)
    future_cutoff = now + timedelta(hours=24)
    
    return {
        "current_timestamp": datetime_to_timestamp(now),
        "query": {
            "reminder_datetime": {
                "$gte": now,
                "$lte": future_cutoff
            },
            "notified": False,
            "status": "pending"
        },
        "sort": [("reminder_datetime", 1)],
        "limit": limit
    }
