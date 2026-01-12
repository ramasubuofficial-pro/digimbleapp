from flask import Blueprint, request, jsonify, session, Response
from utils import supabase, get_supabase_admin
import uuid
import csv
import io
import warnings
# Suppress Google's FutureWarning
warnings.filterwarnings("ignore", category=FutureWarning)

import google.generativeai as genai
from config import Config

# Configure Gemini
if Config.GEMINI_API_KEY:
    genai.configure(api_key=Config.GEMINI_API_KEY)

api_bp = Blueprint('api', __name__, url_prefix='/api')

def get_current_user_id():
    return session.get('user', {}).get('id')

def ensure_db_user(user_id):
    """Self-healing: Ensure user exists in public.users table to prevent FK errors."""
    try:
        # Check existence
        res = supabase.table('users').select('id').eq('id', user_id).execute()
        if not res.data:
            # User missing in DB (but logged in). Insert them now.
            print(f"Self-healing: Creating missing user {user_id} in DB")
            user_data = session.get('user', {})
            meta = user_data.get('user_metadata', {})
            
            payload = {
                'id': user_id,
                'email': user_data.get('email'),
                'full_name': meta.get('full_name', meta.get('name', 'Unknown')),
                'avatar_url': meta.get('avatar_url'),
                'role': 'Team Member'
            }
            supabase.table('users').insert(payload).execute()
    except Exception as e:
        print(f"Warning: Self-healing user check failed: {e}")

# --- TEAM ---
@api_bp.route('/team', methods=['GET'])
def get_team():
    try:
        # Fetch all known users (Simple logic for now. In prod, check permissions)
        res = supabase.table('users').select('*').execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@api_bp.route('/team/<user_id>', methods=['DELETE'])
def delete_team_member(user_id):
    current_user_id = get_current_user_id()
    if not current_user_id: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        if user_id == current_user_id:
            return jsonify({"error": "Cannot delete yourself"}), 400

        # Create separate admin client or just use current client (assuming RLS allows or client is admin-like)
        # Note: If RLS is strict, this might fail unless backend uses SERVICE_ROLE/SECRET Key.
        # We are using SUPABASE_KEY which might be ANON or SERVICE depending on config.
        # Given previous context, it seems to be ANON + user token, or Service role if backend configured so.
        # If it fails due to permissions, we'll know.
        
        # 1. Unassign tasks (Foreign Key Constraint Fix)
        supabase.table("tasks").update({"assigned_to": None}).eq("assigned_to", user_id).execute()
        
        # 2. Delete dependent data
        supabase.table("attendance").delete().eq("user_id", user_id).execute()
        supabase.table("notifications").delete().eq("user_id", user_id).execute()
        
        # 3. Handle projects owned by user (Set to NULL or Transfer to Admin)
        # supabase.table("projects").update({"owner_id": current_user_id}).eq("owner_id", user_id).execute()

        # 4. Delete from Supabase Auth (Crucial to prevent login/re-creation)
        admin_client = get_supabase_admin()
        auth_deleted = False
        if admin_client:
            try:
                # This requires SERVICE_ROLE_KEY
                admin_client.auth.admin.delete_user(user_id)
                auth_deleted = True
            except Exception as auth_e:
                 print(f"Auth Delete Warning: {auth_e}")
        
        # 5. Delete from public.users
        res = supabase.table('users').delete().eq('id', user_id).execute()
        
        msg = "User deleted successfully"
        if not auth_deleted:
            if not admin_client:
                msg += " from Team. NOTE: Auth login remains active (Service Key missing). User implies they can login again."
            else:
                msg += " from Team, but Auth deletion failed."

        return jsonify({"message": msg, "data": res.data})
    except Exception as e:
        print(f"Delete Error: {e}")
        return jsonify({"error": str(e)}), 400

# --- PROJECTS ---

@api_bp.route('/projects', methods=['GET'])
def get_projects():
    user = session.get('user', {})
    user_id = user.get('id')
    role = user.get('role', 'Team Member')  # Default to Member if not found
    
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        if role == 'Admin':
            # Admin sees ALL projects
            res = supabase.table('projects').select('*').order('created_at', desc=True).execute()
        else:
            # Non-Admins: See owned projects OR projects they are members of
            # 1. Get Project IDs where user is member
            memberships = supabase.table('project_members').select('project_id').eq('user_id', user_id).execute()
            member_pids = [str(m['project_id']) for m in memberships.data]
            
            # 2. Query projects where owner_id = user OR id in member_pids
            # Supabase .or_ syntax: `id.in.(...ids...),owner_id.eq.uid` is tricky in one go if ids list is empty.
            # Using basic logic: default to owner_id eq user
            query = supabase.table('projects').select('*').order('created_at', desc=True)
            
            # Construct 'or' filter string
            # Format: 'owner_id.eq.{user_id}' OR 'id.in.({ids})'
            or_filter = f"owner_id.eq.{user_id}"
            if member_pids:
                ids_str = "(" + ",".join(member_pids) + ")"
                or_filter += f",id.in.{ids_str}"
            
            res = query.or_(or_filter).execute()
            
        return jsonify(res.data)
    except Exception as e:
        print(f"Project Fetch Error: {e}")
        return jsonify([]), 400

@api_bp.route('/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    try:
        # Fetch Project Basic info
        res = supabase.table("projects").select("*").eq("id", project_id).single().execute()
        project = res.data
        
        # Fetch Project Members
        try:
            # Join project_members with users table via user_id
            m_res = supabase.table("project_members").select("role, user:user_id(id, full_name, avatar_url, email)").eq("project_id", project_id).execute()
            
            # Flatten/Format members list
            members = []
            for item in m_res.data:
                if item.get('user'):
                    u = item['user']
                    u['role'] = item.get('role', 'Member')
                    members.append(u)
            
            project['members'] = members
        except Exception as e:
            print(f"Error fetching members: {e}")
            project['members'] = []

        return jsonify(project)
    except Exception as e:
        return jsonify({"error": "Project not found"}), 404

@api_bp.route("/projects", methods=["POST"])
def create_project():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    ensure_db_user(user_id)
    data = request.json

    try:
        res = supabase.table("projects").insert({
            "title": data.get("title"),
            "description": data.get("description"),
            "owner_id": user_id,
            "start_date": data.get("start_date"),
            "end_date": data.get("end_date"),
            "status": "Active"
        }).execute()
        
        project = res.data[0]
        
        # Add Members
        members = data.get('members', [])
        if members:
            # Prepare member rows
            # Validate UUIDs or catch errors
            payload = []
            for mid in members:
                if mid and mid != user_id: # Avoid duplicates if creator selects themselves
                    payload.append({"project_id": project['id'], "user_id": mid, "role": "Member"})
            
            # Add creator as Manager/Member explicitly if desired, but owner_id handles permission usually.
            # Let's add creator as 'Manager' for completeness in member table if RBAC logic relies on it.
            payload.append({"project_id": project['id'], "user_id": user_id, "role": "Manager"})
            
            if payload:
                supabase.table("project_members").insert(payload).execute()

        # Get Creator Name
        user_data = session.get('user', {})
        creator_name = user_data.get('user_metadata', {}).get('full_name', user_data.get('email', 'Someone'))
        
        # Notify Broadcast
        # Notify Project Members Only
        if members:
            broadcast_notification(
                title="New Project",
                message=f"{creator_name} created a project [{project['title']}] and added you.",
                link=f"/projects/{project['id']}",
                recipient_ids=members
            )
        
        return jsonify(project), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# Helper: Targeted Notification
def broadcast_notification(title, message, user_id=None, link=None, recipient_ids=None):
    """
    Sends a notification.
    - user_id: Single recipient (legacy support)
    - recipient_ids: List of user IDs to receive the notification
    - If neither is provided, NO notification is sent (Safety default to avoid spam)
    """
    try:
        notifications = []
        target_ids = set()
        
        if user_id:
            target_ids.add(user_id)
            
        if recipient_ids:
            target_ids.update(recipient_ids)
            
        # Default: Project members only if possible, but here we must be explicit.
        # If empty targets and not explicit broadcast request, do nothing.
        
        for uid in target_ids:
            notifications.append({
                "user_id": uid,
                "title": title,
                "message": message,
                "link": link
            })
        
        if notifications:
            supabase.table("notifications").insert(notifications).execute()
            
    except Exception as e:
        print(f"Notification Error: {e}")

# ---------------- TASKS ----------------

@api_bp.route("/projects/<project_id>/tasks", methods=["GET"])
def get_tasks(project_id):
    user = session.get('user', {})
    user_id = user.get('id')
    role = user.get('role', 'Team Member')
    
    try:
        query = supabase.table("tasks").select("*, assignee:assigned_to(full_name, avatar_url)").eq("project_id", project_id)
        
        if role != 'Admin':
            # Team Members: Only see assigned tasks?
            # User request: "team members only see their assigned tasks and projects"
            # This is strict. They won't see other team members' tasks on the same board.
            query = query.eq('assigned_to', user_id)
            
        res = query.execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify([])

@api_bp.route("/user/tasks", methods=["GET"])
def get_user_tasks():
    user_id = get_current_user_id()
    if not user_id: return jsonify([]), 401
    
    try:
        res = supabase.table('tasks').select('*').eq('assigned_to', user_id).order('created_at', desc=True).limit(5).execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@api_bp.route('/tasks', methods=['GET'])
def get_all_tasks():
    user = session.get('user', {})
    user_id = user.get('id')
    role = user.get('role', 'Team Member')
    if not user_id: return jsonify([]), 401
    
    try:
        query = supabase.table('tasks').select('*, project:projects(title), assignee:assigned_to(full_name, avatar_url)').order('created_at', desc=True).limit(50)
        
        if role != 'Admin':
             query = query.eq('assigned_to', user_id)
             
        res = query.execute()
        return jsonify(res.data)
    except Exception as e:
        print(f"Error fetching all tasks: {e}")
        return jsonify({"error": str(e)}), 400

@api_bp.route('/tasks', methods=['POST'])
def create_task():
    user_id = get_current_user_id()
    ensure_db_user(user_id)
    
    data = request.json
    try:
        new_task = {
            'project_id': data.get('project_id'),
            'title': data.get('title'),
            'description': data.get('description'),
            'priority': data.get('priority', 'Medium'),
            'status': 'To Do',
            'deadline': data.get('deadline') or None,
            'created_by': user_id,
            'assigned_to': data.get('assigned_to') or None 
        }
        res = supabase.table('tasks').insert(new_task).execute()
        task = res.data[0]
        
        # Get Creator Name
        user_data = session.get('user', {})
        creator_name = user_data.get('user_metadata', {}).get('full_name', user_data.get('email', 'Someone'))
        
        # Get Assignee Name
        assignee_name = "Unassigned"
        if task.get('assigned_to'):
            try:
                a_res = supabase.table('users').select('full_name').eq('id', task.get('assigned_to')).single().execute()
                if a_res.data:
                    assignee_name = a_res.data.get('full_name', 'Unknown')
            except:
                pass

        # Helper to get project members
        project_members = []
        if task.get('project_id'):
            try:
                # Notify Project Members + Assignee
                pm_res = supabase.table('project_members').select('user_id').eq('project_id', task['project_id']).execute()
                project_members = [m['user_id'] for m in pm_res.data]
            except:
                pass

        # Add Assignee if not in list (though likely is)
        if task.get('assigned_to') and task.get('assigned_to') not in project_members:
             project_members.append(task.get('assigned_to'))

        # Notify
        if project_members:
            broadcast_notification(
                title="New Task Created", 
                message=f"{creator_name} created a task [{task['title']}] and assigned to {assignee_name}.",
                link=f"/projects/{task['project_id']}" if task.get('project_id') else None,
                recipient_ids=project_members
            )
        
        return jsonify(task), 201
    except Exception as e:
        print(f"Error creating task: {e}")
        return jsonify({"error": str(e)}), 400

@api_bp.route('/tasks/<task_id>', methods=['PATCH'])
def update_task(task_id):
    data = request.json
    try:
        # Get old status for comparison logic if needed, or just update
        # For notification, we check if status is in payload
        res = supabase.table('tasks').update(data).eq('id', task_id).execute()
        task = res.data[0]
        
        # Check if status changed to critical states
        new_status = data.get('status')
        if new_status in ['In Progress', 'Completed']:
            # Get Actor Name
            user_data = session.get('user', {})
            actor_name = user_data.get('user_metadata', {}).get('full_name', user_data.get('email', 'Someone'))
            
            # Notify Assignee and Creator
            recipients = set()
            if task.get('assigned_to'): recipients.add(task['assigned_to'])
            if task.get('created_by'): recipients.add(task['created_by'])
            
            # Also notify Project Owner?
            # Fetch project owner if needed, but for now strict to task participants
            
            broadcast_notification(
                title=f"Task {new_status}", 
                message=f"{actor_name} moved task [{task['title']}] to {new_status}.",
                link=f"/projects/{task['project_id']}" if task.get('project_id') else None,
                recipient_ids=list(recipients)
            )

        return jsonify(task)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@api_bp.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    try:
        supabase.table('tasks').delete().eq('id', task_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error deleting task: {e}")
        return jsonify({"error": str(e)}), 400


# ---------------- NOTIFICATIONS ----------------
@api_bp.route("/notifications", methods=["GET"])
def get_notifications():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify([]), 401
    try:
        # Get latest 20 notifications
        res = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(20).execute()
        notifs = res.data
        
        # Calculate unread count (Simplified for stability)
        # unread_res = supabase.table("notifications").select("id", count='exact').eq("user_id", user_id).eq("is_read", False).execute()
        # unread_count = unread_res.count if unread_res.count is not None else 0
        
        # Fallback count: Just count unread in the fetched 20 for now
        unread_count = sum(1 for n in notifs if not n.get('is_read'))
        
        return jsonify({
            "notifications": notifs,
            "unread_count": unread_count
        })
    except Exception as e:
        print(f"Notification Error: {e}")
        # Return empty structure so UI doesn't break
        return jsonify({
            "notifications": [],
            "unread_count": 0
        })

@api_bp.route("/notifications/<notif_id>/read", methods=["POST"])
def mark_notification_read(notif_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    try:
        supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@api_bp.route("/notifications/read-all", methods=["POST"])
def mark_all_read():
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    try:
        supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ---------------- STATS ----------------
@api_bp.route("/stats", methods=["GET"])
def get_stats():
    user = session.get('user', {})
    user_id = user.get('id')
    role = user.get('role', 'Team Member')

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        p_res = supabase.table("projects").select("id, title").execute()
        projects_map = {p["id"]: p["title"] for p in p_res.data}
        
        # Filter stats based on role
        query = supabase.table("tasks").select("id, project_id, status, created_at")
        
        if role != 'Admin':
            # Non-Admins: Only see THEIR assigned tasks in stats
            query = query.eq('assigned_to', user_id)
            
        tasks_res = query.execute()
        tasks = tasks_res.data
        
        # 1. Counts
        total_projects = len(p_res.data)
        total_tasks = len(tasks)
        
        # 2. Status
        status_counts = {"To Do": 0, "In Progress": 0, "Completed": 0}
        for t in tasks:
            s = t.get("status", "To Do")
            status_counts[s] = status_counts.get(s, 0) + 1
            
        # 3. Projects
        proj_counts = {}
        for t in tasks:
            pid = t.get("project_id")
            pname = projects_map.get(pid, "Unknown Project")
            proj_counts[pname] = proj_counts.get(pname, 0) + 1
        sorted_proj = sorted(proj_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # 4. Trend
        from datetime import datetime, timedelta
        today = datetime.now()
        dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
        activity_trend = {d: 0 for d in dates}
        for t in tasks:
            if t.get("created_at"):
                c_date = t.get("created_at").split("T")[0]
                if c_date in activity_trend:
                    activity_trend[c_date] += 1
                    
        return jsonify({
            "total_projects": total_projects,
            "total_tasks": total_tasks,
            "task_stats": status_counts,
            "charts": {
                "status": {"labels": list(status_counts.keys()), "data": list(status_counts.values())},
                "projects": {"labels": [x[0] for x in sorted_proj], "data": [x[1] for x in sorted_proj]},
                "trend": {"labels": dates, "data": [activity_trend[d] for d in dates]}
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- CALENDAR ---
@api_bp.route('/calendar/events', methods=['GET'])
def get_calendar_events():
    user_id = get_current_user_id()
    if not user_id: return jsonify([]), 401
    
    # FullCalendar sends 'start' and 'end' (ISO 8601 strings)
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    
    try:
        # Build Query
        query = supabase.table('tasks').select('*').or_(f"assigned_to.eq.{user_id},created_by.eq.{user_id}")
        
        # Apply Date Filtering if provided
        # We filter on 'deadline' as the primary date for the calendar
        if start_date and end_date:
            # We only want tasks that have a deadline within the view content
            query = query.gte('deadline', start_date).lte('deadline', end_date)
            # Note: tasks without deadline won't be returned, which is correct as they can't be shown on calendar anyway
        else:
            # Fallback (safety limit)
            query = query.not_.is_('deadline', 'null').limit(500)

        res = query.execute()
        tasks = res.data
        
        events = []
        for t in tasks:
            # Color Logic
            color = '#10b981' # Default Emerald
            if t.get('priority') == 'High': color = '#ef4444' # Red
            elif t.get('priority') == 'Medium': color = '#f59e0b' # Amber-500
            elif t.get('status') == 'Completed': color = '#059669' # Emerald-600
            
            if t.get('deadline'):
                # Check for "Midnight UTC" (Date-only default)
                is_all_day = False
                d_str = t['deadline']
                
                # Simple check for T00:00:00 indicating a date-picker selection without time
                if "T00:00:00" in d_str:
                     is_all_day = True
                     # Strip time component for cleaner All Day rendering
                     d_str = d_str.split("T")[0]
                
                events.append({
                    'id': t['id'],
                    'title': t['title'],
                    'start': d_str,
                    'allDay': is_all_day,
                    'backgroundColor': color,
                    'borderColor': color,
                    'extendedProps': {
                        'priority': t.get('priority'),
                        'description': t.get('description'),
                        'status': t.get('status')
                    },
                    'url': f"/projects/{t['project_id']}" if t.get('project_id') else None
                })
        return jsonify(events)
    except Exception as e:
        print(f"Calendar Fetch Error: {e}")
        return jsonify([])

# --- EXPORT ---

@api_bp.route('/export/csv', methods=['GET'])
def get_export_csv():
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        res = supabase.table('tasks').select('title, status, priority, deadline, created_at').eq('created_by', user_id).execute()
        tasks = res.data
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Title', 'Status', 'Priority', 'Deadline', 'Created At'])
        for t in tasks:
            writer.writerow([t.get('title'), t.get('status'), t.get('priority'), t.get('deadline'), t.get('created_at')])
            
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": "attachment; filename=tasks_report.csv"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- AI CHAT ---
@api_bp.route("/chat", methods=["POST"])
def chat_ai():
    msg = request.json.get("message", "").strip()

    if not msg:
        return jsonify({"response": "Please enter a message."})

    if not Config.GEMINI_API_KEY:
        return jsonify({"response": "AI is not configured."})

    # ---- Context ----
    try:
        p = supabase.table("projects").select("id", count="exact").execute()
        t = supabase.table("tasks").select("id", count="exact").execute()
        context = f"Projects: {p.count}, Tasks: {t.count}"
    except Exception as e:
        print("Context error:", e)
        context = "Workspace data unavailable"

    try:
        # ✅ USE FULL MODEL ID
        model = genai.GenerativeModel("models/gemini-2.5-flash")

        prompt = f'''
You are the AI assistant for Antigravity PM.

Context:
{context}

User:
{msg}

Rules:
- Be friendly and concise (max 60 words)
- Stay related to projects/tasks
- Guide user to UI for actions
'''

        response = model.generate_content(prompt)

        if not response or not getattr(response, "text", None):
            raise Exception("Empty response from Gemini")

        return jsonify({"response": response.text})

    except Exception as e:
        # 🔍 THIS WILL NOW SHOW REAL ERRORS IF ANY
        print("Gemini error:", repr(e))

# ---------------- ATTENDANCE ----------------

@api_bp.route("/attendance/today", methods=["GET"])
def get_attendance_today():
    user_id = get_current_user_id()
    if not user_id: 
        return jsonify({"error": "Unauthorized"}), 401
    
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    
    try:
        res = supabase.table("attendance").select("*").eq("user_id", user_id).eq("date", today).single().execute()
        return jsonify(res.data)
    except Exception:
        return jsonify(None) # No record found

@api_bp.route("/attendance/punch", methods=["POST"])
def punch_attendance():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    from datetime import datetime, timezone
    # Use UTC for storage to avoid timezone offsets issues (local -> naive -> +Z -> local+offset)
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    try:
        # Check existing
        existing = supabase.table("attendance").select("*").eq("user_id", user_id).eq("date", today).execute()
        
        if not existing.data:
            # PUNCH IN
            data_in = request.json or {}
            location = data_in.get("location")
            
            payload = {
                "user_id": user_id,
                "date": today,
                "punch_in": now.isoformat(),
                "status": "Present"
            }
            # Try inserting with location
            if location:
                payload["location"] = location

            try:
                res = supabase.table("attendance").insert(payload).execute()
                return jsonify({"message": "Punched In", "data": res.data[0], "type": "in"})
            except Exception as e:
                # Check for "column not found" error
                err_str = str(e)
                if "PGRST204" in err_str or "Could not find the 'location' column" in err_str:
                    print("Location column missing. Retrying without location.")
                    if "location" in payload:
                        del payload["location"]
                    res = supabase.table("attendance").insert(payload).execute()
                    return jsonify({"message": "Punched In (Location not saved: DB schema pending)", "data": res.data[0], "type": "in", "warning": "missing_col"})
                else:
                    raise e
        
        else:
            record = existing.data[0]
            if record.get("punch_out"):
                return jsonify({"error": "Already punched out for today."}), 400
            
            # PUNCH OUT
            data_out = request.json or {}
            loc_out = data_out.get("location")

            update_payload = {
                "punch_out": now.isoformat(),
                "status": "Present"
            }
            if loc_out:
                update_payload["punch_out_location"] = loc_out

            try:
                res = supabase.table("attendance").update(update_payload).eq("id", record["id"]).execute()
                return jsonify({"message": "Punched Out", "data": res.data[0], "type": "out"})
            except Exception as e:
                # Fallback if punch_out_location column is missing
                if "punch_out_location" in update_payload:
                    print("punch_out_location column missing, retrying...")
                    del update_payload["punch_out_location"]
                    res = supabase.table("attendance").update(update_payload).eq("id", record["id"]).execute()
                    return jsonify({"message": "Punched Out (Location not saved)", "data": res.data[0], "type": "out", "warning": "missing_col"})
                else:
                    raise e
            
    except Exception as e:
        print(f"Attendance Error: {e}")
        return jsonify({"error": str(e)}), 400

@api_bp.route("/attendance/history", methods=["GET"])
def get_attendance_history():
    user_id = get_current_user_id()
    if not user_id: return jsonify([]), 401
    
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    try:
        query = supabase.table("attendance").select("*").eq("user_id", user_id).order("date", desc=True)
        
        if month and year:
            import calendar
            _, last_day = calendar.monthrange(year, month)
            start_date = f"{year}-{month:02d}-01"
            end_date = f"{year}-{month:02d}-{last_day}"
            query = query.gte("date", start_date).lte("date", end_date)
        else:
            query = query.limit(30)
            
        res = query.execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ---------------- ADMIN ROUTES ----------------
@api_bp.route("/admin/attendance-history", methods=["GET"])
def get_admin_attendance_history():
    # Role Check
    user = session.get('user', {})
    if user.get('role') != 'Admin':
        return jsonify({"error": "Unauthorized"}), 403

    target_user_id = request.args.get('user_id')

    try:
        # Build Query
        query = supabase.table("attendance").select("*").order("date", desc=True)
        
        if target_user_id:
            query = query.eq("user_id", target_user_id)
            
        res = query.limit(100).execute()
        attendance_data = res.data
        
        if not attendance_data:
            return jsonify([])

        # Get unique user IDs involved
        user_ids = list(set([r['user_id'] for r in attendance_data]))
        
        # Fetch Users details
        if user_ids:
            users_res = supabase.table("users").select("id, full_name, email").in_("id", user_ids).execute()
            users_map = {u['id']: u for u in users_res.data}
            
            # Merge
            final_data = []
            for record in attendance_data:
                u = users_map.get(record['user_id'], {})
                record['user_name'] = u.get('full_name') or u.get('email') or 'Unknown'
                final_data.append(record)
            
            return jsonify(final_data)
        
        return jsonify(attendance_data)

    except Exception as e:
        print(f"Admin History Error: {e}")
        return jsonify({"error": str(e)}), 400

@api_bp.route("/admin/users", methods=["GET"])
def get_all_users_admin():
    # Role Check
    user = session.get('user', {})
    if user.get('role') != 'Admin':
        return jsonify({"error": "Unauthorized"}), 403
        
    try:
        res = supabase.table("users").select("id, full_name, email").execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ---------------- USER PROFILE ----------------
@api_bp.route("/user/profile", methods=["POST"])
def update_profile():
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    full_name = data.get("full_name", "").strip()
    
    if not full_name:
        return jsonify({"error": "Full name is required"}), 400
        
    try:
        # 1. Update public.users table (for app display)
        supabase.table("users").update({"full_name": full_name}).eq("id", user_id).execute()
        
        # 2. Update Supabase Auth User Metadata (optional but good for consistency)
        try:
            supabase.auth.update_user({
                "data": { "full_name": full_name }
            })
        except Exception as auth_e:
            print(f"Auth metadata update warning: {auth_e}")
            
        # 3. Update Flask Session to reflect change immediately
        if 'user' in session:
            # We need to deep copy or re-assign to trigger session modification
            user = session['user']
            if 'user_metadata' not in user: user['user_metadata'] = {}
            user['user_metadata']['full_name'] = full_name
            session['user'] = user
            session.modified = True
            
        return jsonify({"message": "Profile updated successfully"})
        
    except Exception as e:
        print(f"Profile Update Error: {e}")
        return jsonify({"error": "Failed to update profile"}), 500

# ---------------- TEAM / INVITE ----------------

@api_bp.route("/invite", methods=["POST"])
def invite_member():
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    email = data.get("email")
    role = data.get("role", "Member")
    
    if not email:
        return jsonify({"error": "Email is required"}), 400

    admin_client = get_supabase_admin()
    if not admin_client:
        return jsonify({"error": "Server configuration error: Missing Service Key"}), 500

    # 1. Generate Temp Password
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits
    temp_password = ''.join(secrets.choice(alphabet) for i in range(12))

    invited_user_id = None

    try:
        # 2. Admin Create User
        # We use admin.create_user to force creation and get ID
        auth_res = admin_client.auth.admin.create_user({
            "email": email,
            "password": temp_password,
            "email_confirm": True, 
            "user_metadata": {"full_name": "Invited Member", "role": role}
        })
        invited_user_id = auth_res.user.id
        
    except Exception as e:
        print(f"Auth Create Error (Likely Exists): {e}")
        # RECOVERY FLOW: User exists in Auth, but we want to reset them.
        try:
            # 2a. Find User ID
            # HACK: List users to find ID. API doesn't list by email easily.
            # We assume the list isn't huge.
            all_users = admin_client.auth.admin.list_users(per_page=1000)
            # Check if all_users is a list or object with .users
            users_list = all_users if isinstance(all_users, list) else getattr(all_users, 'users', [])
            
            target_user = next((u for u in users_list if u.email == email), None)
            
            if target_user:
                invited_user_id = target_user.id
                print(f"Found existing Auth User: {invited_user_id}. Updating credentials.")
                
                # 2b. Update Password & Metadata
                admin_client.auth.admin.update_user_by_id(invited_user_id, {
                    "password": temp_password,
                    "user_metadata": {"full_name": "Invited Member", "role": role},
                    "email_confirm": True
                })
            else:
                 return jsonify({"error": "User email exists in Auth logic but not found in list. Please contact admin."}), 400

        except Exception as recovery_e:
            print(f"Auth Recovery Failed: {recovery_e}")
            return jsonify({"error": f"Failed to reset existing user: {str(recovery_e)}"}), 500

    if not invited_user_id:
        return jsonify({"error": "Failed to resolve User ID"}), 500

    # 3. CRITICAL: Insert into public.users to ALLOW login
    try:
        supabase.table("users").upsert({
            "id": invited_user_id,
            "email": email,
            "full_name": "Invited Member",
            "role": role
            # avatar_url is optional
        }).execute()
    except Exception as db_e:
        print(f"DB Upsert Error: {db_e}")
        # If DB fails, maybe delete Auth to keep clean?
        return jsonify({"error": f"Database Error: {db_e}"}), 500

    # 4. Send Email via SMTP
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    sender_email = Config.SMTP_EMAIL
    sender_password = Config.SMTP_PASSWORD

    if not sender_email or not sender_password:
         return jsonify({"message": f"User created/restored! Password: {temp_password} (SMTP not configured)"}), 200

    try:
        msg = MIMEMultipart()
        msg['From'] = f"DIGIANCHORZ <{sender_email}>"
        msg['To'] = email
        msg['Subject'] = "You've been invited to Digianchorz PM"

        body = f"""
        <html>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                
                <h2 style="color: #4f46e5; text-align: center; margin-bottom: 24px; font-weight: 800; font-size: 24px;">Welcome to Digianchorz</h2>
                
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    Hello,
                    <br><br>
                    You have been invited to join the <strong>Digianchorz Project Management</strong> workspace as a <strong>{role}</strong>. We've set up an account for you to get started immediately.
                </p>

                <div style="background-color: #f1f5f9; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em; margin-bottom: 12px;">Your Login Credentials</p>
                    <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>Email:</strong> {email}</p>
                    <p style="margin: 0; font-size: 16px;"><strong>Password:</strong> <span style="font-family: monospace; background-color: #e2e8f0; padding: 4px 8px; rounded: 4px; color: #0f172a;">{temp_password}</span></p>
                </div>

                <div style="text-align: center; margin-bottom: 32px;">
                    <a href="{request.host_url}login" style="background-color: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Login to Dashboard</a>
                </div>

                <p style="text-align: center; font-size: 14px; color: #64748b;">
                    Please change your password after logging in for security.
                </p>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, "html"))

        # Send
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, email, msg.as_string())
        server.quit()
        
        return jsonify({"message": f"Invitation and credentials sent to {email}"})

    except Exception as e:
        print(f"SMTP Error: {e}")
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500
