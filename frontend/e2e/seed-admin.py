"""Creates (or reuses) the e2e super admin. Usage: seed-admin.py EMAIL PASSWORD"""

import sys

from app.cli import create_admin

try:
    create_admin(sys.argv[1], "Admin E2E", "super_admin", sys.argv[2])
except SystemExit:
    pass  # already exists from an earlier run
