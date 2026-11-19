"""QR design (version 1). Stored in qr_codes.design and in style presets."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

HEX = r"^#[0-9a-fA-F]{6}$"
LOGO_MAX = 0.3  # logo side as a fraction of the symbol: beyond this H correction is not enough


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Fill(Strict):
    type: Literal["solid", "linear", "radial"] = "solid"
    color: str = Field(default="#091411", pattern=HEX)
    color2: str = Field(default="#087f5b", pattern=HEX)
    angle: int = Field(default=45, ge=0, le=360)

    @field_validator("color", "color2")
    @classmethod
    def lower(cls, value: str) -> str:
        return value.lower()


class Logo(Strict):
    file_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    size: float = Field(default=0.22, ge=0.1, le=LOGO_MAX)
    padding: float = Field(default=0.02, ge=0, le=0.08)
    plate: bool = True  # light rounded plate behind the logo


class QrDesign(Strict):
    version: Literal[1] = 1
    modules: Literal["square", "rounded", "dots", "classy", "extra_rounded"] = "square"
    eye_frame: Literal["square", "rounded", "circle", "leaf", "extra_rounded"] = "square"
    eye_ball: Literal["square", "rounded", "circle", "leaf"] = "square"  # no diamond: unreadable
    fill: Fill = Field(default_factory=Fill)
    eye_color: str | None = Field(default=None, pattern=HEX)
    background: str = Field(default="#ffffff", pattern=HEX)
    transparent: bool = False
    margin: int = Field(default=4, ge=0, le=16)
    error_correction: Literal["L", "M", "Q", "H"] = "M"
    logo: Logo | None = None

    @model_validator(mode="after")
    def logo_forces_h(self):
        if self.logo is not None:
            self.error_correction = "H"
        return self

    @classmethod
    def from_legacy(cls, fg: str, bg: str, margin: int, error_correction: str) -> "QrDesign":
        """0.1 QR codes only had colors, margin and correction."""
        return cls(fill=Fill(color=fg), background=bg, margin=margin,
                   error_correction=error_correction)  # fmt: skip
