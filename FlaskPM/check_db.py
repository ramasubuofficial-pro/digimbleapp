from config import Config
from utils import get_supabase

supabase = get_supabase()

print("Checking project_members table...")
try:
    res = supabase.table("project_members").select("*").limit(1).execute()
    print("Success! Table exists.")
    print(res.data)
except Exception as e:
    print(f"Error: {e}")
