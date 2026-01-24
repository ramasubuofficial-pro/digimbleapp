from api_keys import keys

class Config:
    SECRET_KEY = keys.SECRET_KEY
    SUPABASE_URL = keys.SUPABASE_URL
    SUPABASE_KEY = keys.SUPABASE_KEY
    SUPABASE_SERVICE_KEY = keys.SUPABASE_SERVICE_KEY
    GOOGLE_CLIENT_ID = keys.GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET = keys.GOOGLE_CLIENT_SECRET
    GEMINI_API_KEY = keys.GEMINI_API_KEY
    SMTP_EMAIL = keys.SMTP_EMAIL
    SMTP_PASSWORD = keys.SMTP_PASSWORD

    if not SUPABASE_SERVICE_KEY:
        print("WARNING: SUPABASE_SERVICE_KEY not found in environment!")
    else:
        print(f"DEBUG: Service Key Loaded ({SUPABASE_SERVICE_KEY[:5]}...)")
