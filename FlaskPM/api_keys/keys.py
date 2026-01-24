# API Keys & Configuration
# This file is the single source of truth for all API keys.
# You can edit the values directly here.

# Supabase Configuration
# Used for: Connecting to the Supabase database (Postgres).
# Location: config.py, utils.py
SUPABASE_URL = "https://sjxmnmbwearcxveeeawj.supabase.co"
SUPABASE_KEY = "sb_publishable_GlO5j-xLloZH0an9kcniJQ_MOOaVqdz"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeG1ubWJ3ZWFyY3h2ZWVlYXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU4NTg2NywiZXhwIjoyMDgzMTYxODY3fQ.YoSUHux4VnHZf0ZkWvRBD8etKN1K8zTnkRn5FZ7SiA8"

# Google OAuth Configuration
# Used for: Google Sign-In authentication.
# Location: config.py
GOOGLE_CLIENT_ID = "1040472761740-tq1ossabg91rtv64vu2ao261d1rjba8v.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET = "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"

# Flask Configuration
# Used for: Flask session signing and security.
# Location: config.py
SECRET_KEY = "7c268894df456722238491763177695c0164284534f3a746"

# Gemini AI Configuration
# Used for: AI features (if implemented).
# Location: config.py
GEMINI_API_KEY = "AIzaSyB0JjTQb41STeOoavMOq0sXWVnY8tE8y-Q"

# SMTP Email Configuration
# Used for: Sending emails (notifications, deadlines).
# Location: config.py, scheduler.py
SMTP_EMAIL = "ramcraze3@gmail.com"
SMTP_PASSWORD = "zbcucpxwuughhnio"
