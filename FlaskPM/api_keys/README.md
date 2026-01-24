# API Keys Documentation

This folder contains the centralized configuration for all API keys and secrets used in this application.

**IMPORTANT:** The keys are defined directly in `api_keys/keys.py`. You can edit them there.

## Available Keys

| Key Name | Purpose | Usage Location |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Endpoint URL for the Supabase project. | `utils.py`, `config.py` |
| `SUPABASE_KEY` | Public/Anon key for client-side Supabase operations. | `utils.py`, `config.py` |
| `SUPABASE_SERVICE_KEY` | Secret Service Role key for admin/backend Supabase operations. | `utils.py`, `scheduler.py`, `config.py` |
| `GOOGLE_CLIENT_ID` | Client ID for Google OAuth. | `config.py`, Templates |
| `GOOGLE_CLIENT_SECRET` | Client Secret for Google OAuth. | `config.py` |
| `SECRET_KEY` | Flask secret key for signing sessions. | `config.py` |
| `GEMINI_API_KEY` | API key for Gemini AI. | `config.py` |
| `SMTP_EMAIL` | Email address used for sending automated emails. | `scheduler.py`, `config.py` |
| `SMTP_PASSWORD` | App Password for the SMTP email account. | `scheduler.py`, `config.py` |

## How to Change a Key

1.  Open **[api_keys/keys.py](file:///d:/Antigravity%20-%20Copy/FlaskPM/api_keys/keys.py)**.
2.  Find the variable you want to change (e.g., `SMTP_PASSWORD`).
3.  Update the value inside the quotes.
4.  Save the file.
5.  Restart the application to apply changes.
