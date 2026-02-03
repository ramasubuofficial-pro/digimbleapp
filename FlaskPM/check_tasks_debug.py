from utils import supabase
import json

try:
    print("Fetching Users...")
    users = supabase.table('users').select('id, full_name').execute().data
    u_map = {u['id']: u['full_name'] for u in users}
    print(f"Users Map: {u_map}")

    print("\nFetching Tasks...")
    tasks = supabase.table('tasks').select('*').limit(20).execute().data
    print(f"Tasks Count (Top 20): {len(tasks)}")
    
    admins = [uid for uid, name in u_map.items() if 'Ram c' in name]
    admin_id = admins[0] if admins else None
    print(f"Admin ID: {admin_id}")

    assigned_count = 0
    completed_count = 0
    
    for t in tasks:
        assignee = t.get('assigned_to')
        status = t.get('status')
        print(f"Task: {t.get('title')} | AssignedTo: {assignee} ({u_map.get(assignee, 'UNKNOWN')}) | Status: {status}")
        
        if assignee == admin_id:
            assigned_count += 1
            if status == 'Completed':
                completed_count += 1
                
    print(f"\nAdmin Stats Calculation Test for {admin_id}:")
    print(f"Assigned: {assigned_count}, Completed: {completed_count}")

except Exception as e:
    print(f"Error: {e}")
