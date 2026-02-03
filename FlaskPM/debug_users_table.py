from utils import supabase
try:
    res = supabase.table("users").select("*").limit(1).execute()
    if res.data:
        print(f"Columns in 'users': {list(res.data[0].keys())}")
    else:
        print("No data in 'users' table")
except Exception as e:
    print(f"Error: {e}")
