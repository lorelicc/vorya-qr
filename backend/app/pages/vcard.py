"""vCard 3.0 (the version iOS and Android import most reliably)."""

from ..schemas.page import ContactBlock

PHONE_TYPE = {"cell": "CELL", "work": "WORK", "home": "HOME", "other": "VOICE"}
EMAIL_TYPE = {"work": "WORK", "home": "HOME", "other": "INTERNET"}


def esc(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", r"\;")


def fold(line: str) -> str:
    """RFC 6350 line folding at 75 octets."""
    data, out = line.encode(), []
    while len(data) > 75:
        cut = 75
        while cut > 0 and (data[cut] & 0xC0) == 0x80:  # never split a UTF-8 sequence
            cut -= 1
        out.append(data[:cut].decode())
        data = b" " + data[cut:]
    out.append(data.decode())
    return "\r\n".join(out)


def vcard(c: ContactBlock) -> str:
    full = " ".join(p for p in (c.first_name, c.last_name) if p) or c.organization
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"N:{esc(c.last_name)};{esc(c.first_name)};;;",
        f"FN:{esc(full)}",
    ]
    if c.organization:
        lines.append(f"ORG:{esc(c.organization)}")
    if c.job_title:
        lines.append(f"TITLE:{esc(c.job_title)}")
    lines += [f"TEL;TYPE={PHONE_TYPE[p.label]}:{esc(p.number)}" for p in c.phones]
    lines += [f"EMAIL;TYPE={EMAIL_TYPE[e.label]}:{esc(e.address)}" for e in c.emails]
    if c.website:
        lines.append(f"URL:{esc(c.website)}")
    a = c.address
    if any((a.street, a.city, a.postal_code, a.region, a.country)):
        parts = ";".join(
            esc(v) for v in ("", "", a.street, a.city, a.region, a.postal_code, a.country)
        )
        lines.append(f"ADR;TYPE=WORK:{parts}")
    if c.note:
        lines.append(f"NOTE:{esc(c.note)}")
    lines.append("END:VCARD")
    return "\r\n".join(fold(line) for line in lines) + "\r\n"
