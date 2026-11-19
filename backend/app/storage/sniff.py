"""File type detection by magic bytes. The client's filename and Content-Type are ignored.

Allowed: PDF; JPEG, PNG, WebP images (never SVG); MP3, M4A/AAC, WAV audio.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Sniffed:
    kind: str  # image | pdf | audio
    mime: str
    ext: str


M4A_BRANDS = (b"M4A ", b"M4B ", b"mp42", b"mp41", b"isom", b"iso2", b"dash")


def sniff(head: bytes) -> Sniffed | None:
    if head.startswith(b"%PDF-"):
        return Sniffed("pdf", "application/pdf", "pdf")
    if head.startswith(b"\xff\xd8\xff"):
        return Sniffed("image", "image/jpeg", "jpg")
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return Sniffed("image", "image/png", "png")
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return Sniffed("image", "image/webp", "webp")
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return Sniffed("audio", "audio/wav", "wav")
    if head.startswith(b"ID3") or (
        len(head) > 1 and head[0] == 0xFF and head[1] in (0xFB, 0xF3, 0xF2, 0xFA)
    ):
        return Sniffed("audio", "audio/mpeg", "mp3")
    if head[4:8] == b"ftyp" and head[8:12] in M4A_BRANDS:
        return Sniffed("audio", "audio/mp4", "m4a")
    if len(head) > 1 and head[0] == 0xFF and head[1] in (0xF1, 0xF9):
        return Sniffed("audio", "audio/aac", "aac")
    return None
