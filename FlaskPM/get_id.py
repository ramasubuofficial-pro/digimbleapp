from utils import supabase
res = supabase.table('users').select('id, email').eq('email', 'ramcraze3@gmail.com').single().execute()
print(f"USER_ID: {res.data['id']}")
