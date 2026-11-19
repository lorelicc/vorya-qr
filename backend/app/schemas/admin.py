from pydantic import BaseModel, ConfigDict, Field


class PlanUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=500)
    max_qr_static: int | None = Field(default=None, ge=0, le=1_000_000)
    max_dynamic_qr: int | None = Field(default=None, ge=0, le=1_000_000)


class AssignPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_id: str = Field(pattern=r"^[a-z0-9_-]{1,24}$")
