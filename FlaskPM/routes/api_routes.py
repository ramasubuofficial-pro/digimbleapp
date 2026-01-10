from flask import Blueprint, request, jsonify, session, Response
from utils import supabase
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
        # Assuming owner_id is nullable or we reassign to deleter
        # supabase.table("projects").update({"owner_id": current_user_id}).eq("owner_id", user_id).execute()

        res = supabase.table('users').delete().eq('id', user_id).execute()
        return jsonify({"message": "User deleted", "data": res.data})
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
        # Note: Ideally check permissions here too for strict security
        res = supabase.table("projects").select("*").eq("id", project_id).single().execute()
        return jsonify(res.data)
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
        broadcast_notification(
            title="New Project",
            message=f"{creator_name} created a project [{project['title']}].",
            link=f"/projects/{project['id']}"
        )
        
        return jsonify(project), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# Helper: Broadcast Notification
def broadcast_notification(title, message, user_id=None, link=None):
    """
    Sends a notification.
    If user_id is provided, sends to that specific user.
    If user_id is None, broadcasts to ALL users.
    """
    try:
        notifications = []
        
        if user_id:
            # Single User
            notifications.append({
                "user_id": user_id,
                "title": title,
                "message": message,
                "link": link
            })
        else:
            # Broadcast to All Users
            users_res = supabase.table("users").select("id").execute()
            for u in users_res.data:
                notifications.append({
                    "user_id": u['id'],
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

        # Notify Broadcast
        broadcast_notification(
            title="New Task Created", 
            message=f"{creator_name} created a task [{task['title']}] and assigned to {assignee_name}.",
            link=f"/projects/{task['project_id']}" if task.get('project_id') else None
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
            
            broadcast_notification(
                title=f"Task {new_status}", 
                message=f"{actor_name} moved task [{task['title']}] to {new_status}.",
                link=f"/projects/{task['project_id']}" if task.get('project_id') else None
            )

        return jsonify(task)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ---------------- NOTIFICATIONS ----------------
@api_bp.route("/notifications", methods=["GET"])
def get_notifications():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify([]), 401
    try:
        res = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ---------------- STATS ----------------
@api_bp.route("/stats", methods=["GET"])
def get_stats():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        p_res = supabase.table("projects").select("id, title").execute()
        projects_map = {p["id"]: p["title"] for p in p_res.data}
        
        tasks_res = supabase.table("tasks").select("id, project_id, status, created_at").execute()
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
    
    try:
        res = supabase.table('tasks').select('*').or_(f"assigned_to.eq.{user_id},created_by.eq.{user_id}").execute()
        tasks = res.data
        
        events = []
        for t in tasks:
            color = '#3b82f6'
            if t.get('status') == 'Completed': color = '#10b981'
            elif t.get('priority') == 'High': color = '#ef4444'
            
            if t.get('deadline'):
                # Check for "Midnight UTC" (Date-only default)
                # Typical format: 2026-01-09T00:00:00+00:00 or Z
                is_all_day = False
                d_str = t['deadline']
                if "T00:00:00" in d_str and ("+00:00" in d_str or d_str.endswith("Z")):
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
            res = supabase.table("attendance").insert({
                "user_id": user_id,
                "date": today,
                "punch_in": now.isoformat(),
                "status": "Present"
            }).execute()
            return jsonify({"message": "Punched In", "data": res.data[0], "type": "in"})
        
        else:
            record = existing.data[0]
            if record.get("punch_out"):
                return jsonify({"error": "Already punched out for today."}), 400
            
            # PUNCH OUT
            res = supabase.table("attendance").update({
                "punch_out": now.isoformat(),
                "status": "Present"
            }).eq("id", record["id"]).execute()
            
            return jsonify({"message": "Punched Out", "data": res.data[0], "type": "out"})
            
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

    # 1. Generate Temp Password
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits
    temp_password = ''.join(secrets.choice(alphabet) for i in range(10))

    try:
        # 2. Register User in Supabase (Client-side sign up)
        # Note: If email confirmation is ON, user might still need to confirm via Supabase email.
        # But we will give them credentials anyway.
        auth_res = supabase.auth.sign_up({
            "email": email,
            "password": temp_password,
            "options": {
                "data": {"full_name": "Invited Member", "role": role}
            }
        })
        
        # Check if user actually created (or if auto-confirm is on)
        if not auth_res.user:
            # Might be rate limited or existing user
            pass 

    except Exception as e:
        # If user already exists, we might just want to Invite them (send email) 
        # but we can't see their password. 
        # For this simplified flow, we'll assume new user or ignore error if they exist.
        print(f"Auth Signup Error (User might exist): {e}")

    # 3. Create/Update Profile in public table (if not handled by Trigger)
    # Ideally triggers handle this, but let's ensure they are in 'users' table
    # We don't have their ID easily if sign_up doesn't return it cleanly on duplicate.
    # We will skip manual insertion and rely on the sign_up or existing user.

    # 4. Send Email via SMTP
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    sender_email = Config.SMTP_EMAIL
    sender_password = Config.SMTP_PASSWORD

    if not sender_email or not sender_password:
         return jsonify({"error": "SMTP Configuration Missing"}), 500

    try:
        # Create message
        msg = MIMEMultipart()
        msg["From"] = sender_email
        msg["To"] = email
        msg["Subject"] = "You're invited to join Antigravity PM"

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">Antigravity PM</h2>
                <p>Hello,</p>
                <p>You have been invited to join the <strong>Antigravity</strong> workspace as a <strong>{role}</strong>.</p>
                <p>We have created an account for you.</p>
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold;">Login Credentials:</p>
                    <p style="margin: 5px 0;">Email: {email}</p>
                    <p style="margin: 5px 0;">Password: <strong>{temp_password}</strong></p>
                </div>
                <p>Click the button below to sign in:</p>
                <a href="{request.host_url}auth/login" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now</a>
                <p style="margin-top: 20px; font-size: 12px; color: #888;">Please change your password after logging in.</p>
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
