import os

# Try to load local keys if available
try:
    from api_keys import keys
except ImportError:
    keys = None

class Config:
    # Prioritize Environment Variables (for Render/Deployment)
    SECRET_KEY = os.environ.get('SECRET_KEY') or (keys.SECRET_KEY if keys else None)
    SUPABASE_URL = os.environ.get('SUPABASE_URL') or (keys.SUPABASE_URL if keys else None)
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY') or (keys.SUPABASE_KEY if keys else None)
    SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or (keys.SUPABASE_SERVICE_KEY if keys else None)
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID') or (keys.GOOGLE_CLIENT_ID if keys else None)
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET') or (keys.GOOGLE_CLIENT_SECRET if keys else None)
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY') or (keys.GEMINI_API_KEY if keys else None)
    SMTP_EMAIL = os.environ.get('SMTP_EMAIL') or (keys.SMTP_EMAIL if keys else None)
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD') or (keys.SMTP_PASSWORD if keys else None)

    # Session / Cookie Configuration for Cross-Origin (Mobile/Ngrok)
    SESSION_COOKIE_SAMESITE = 'None'
    SESSION_COOKIE_SECURE = True  # Required when SAMESITE is None

    @classmethod
    def validate(cls):
        if not cls.SUPABASE_SERVICE_KEY:
            print("WARNING: SUPABASE_SERVICE_KEY not found!")
        else:
            print(f"DEBUG: Service Key Loaded ({cls.SUPABASE_SERVICE_KEY[:5]}...)")

Config.validate()
