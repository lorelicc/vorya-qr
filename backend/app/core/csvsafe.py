"""CSV cells that a spreadsheet could execute as a formula are prefixed with an apostrophe."""

DANGEROUS = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value):
    if isinstance(value, str) and value and value[0] in DANGEROUS:
        return "'" + value
    return value


def safe_row(cells) -> list:
    return [safe_cell(c) for c in cells]
