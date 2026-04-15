from datetime import datetime

from typing import Annotated
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints


TrimmedText100 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class UserRegister(BaseModel):
    display_name: TrimmedText100
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    email: EmailStr
    preferred_language: Literal["pt", "en", "es", "pl"] = "pt"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserPreferencesUpdate(BaseModel):
    preferred_language: Literal["pt", "en", "es", "pl"]
