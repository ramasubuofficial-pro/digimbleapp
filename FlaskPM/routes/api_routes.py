from flask import Blueprint, request, jsonify, session, Response, g
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

# Helper: Verify Auth Token (Used for Bearer Auth)
def get_current_user_id():
    # 1. Try Session (Cookie)
    user_id = session.get('user', {}).get('id')
    if user_id: 
        return user_id

    # 2. Try Bearer Token (Header)
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        try:
            token = auth_header.split(' ')[1]
            res = supabase.auth.get_user(token)
            if res.user:
                g.current_user = res.user
                return res.user.id
            else:
                print("Auth Error: Token verification failed (no user returned)")
        except Exception as e:
            print(f"Auth Exception: {str(e)}")
    
    return None

# --- TEAM ---
@api_bp.route('/team', methods=['GET'])
def get_team():
    user_id = get_current_user_id()
    if not user_id: return jsonify([]), 401
    
    try:
        admin = get_supabase_admin()
        # Fetch all known users
        res = admin.table('users').select('*').execute()
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
    user_id = get_current_user_id()
    if not user_id: 
        return jsonify({"error": "Unauthorized"}), 401
    
    # Get user role from DB for accuracy
    admin = get_supabase_admin()
    u_res = admin.table('users').select('role').eq('id', user_id).execute()
    
    # STRICT: If user not in DB, they shouldn't even reach here, but let's be double safe.
    if not u_res.data:
        print(f"Access Denied: User {user_id} not found in public.users")
        return jsonify({"error": "Unauthorized: User record missing from database"}), 401
    
    role = u_res.data[0].get('role', 'Team Member')
    
    try:
        if role == 'Admin':
            # Admin sees ALL projects
            res = admin.table('projects').select('*').order('created_at', desc=True).execute()
        else:
            # Non-Admins: See owned projects OR projects they are members of
            # 1. Get Project IDs where user is member
            memberships = admin.table('project_members').select('project_id').eq('user_id', user_id).execute()
            member_pids = [str(m['project_id']) for m in memberships.data]
            
            # 2. Query projects where owner_id = user OR id in member_pids
            query = admin.table('projects').select('*').order('created_at', desc=True)
            
            # Construct 'or' filter string
            or_filter = f"owner_id.eq.{user_id}"
            if member_pids:
                ids_str = "(" + ",".join(member_pids) + ")"
                or_filter += f",id.in.{ids_str}"
            
            res = admin.table('projects').select('*').or_(or_filter).order('created_at', desc=True).execute()
        
        projects = res.data
        
        # Fetch Members for these projects to display avatars/count on cards
        if projects:
            p_ids = [p['id'] for p in projects]
            try:
                # Fetch members with user details
                m_res = supabase.table('project_members').select('project_id, user:user_id(id, full_name, avatar_url)').in_('project_id', p_ids).execute()
                
                # Group members by project_id
                members_map = {}
                for relation in m_res.data:
                    pid = str(relation['project_id'])
                    if pid not in members_map: members_map[pid] = []
                    
                    if relation.get('user'):
                        members_map[pid].append(relation['user'])
                
                # Attach to projects
                for p in projects:
                    p['members'] = members_map.get(str(p['id']), [])
                    
            except Exception as me:
                print(f"Member Fetch Error: {me}")
                # Don't fail the whole request, just return empty members
                for p in projects: p['members'] = []

        return jsonify(projects)
    except Exception as e:
        print(f"Project Fetch Error: {e}")
        return jsonify([]), 400

@api_bp.route('/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    admin = get_supabase_admin()
    try:
        # Fetch Project Basic info
        res = admin.table("projects").select("*").eq("id", project_id).single().execute()
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

@api_bp.route('/projects/<project_id>', methods=['PATCH'])
def update_project(project_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Check Admin Role from DB for security
        u_res = supabase.table('users').select('role').eq('id', user_id).single().execute()
        if not u_res.data or u_res.data.get('role') != 'Admin':
             return jsonify({"error": "Unauthorized: Admin privileges required"}), 403
             
        data = request.json
        updates = {}
        if 'status' in data:
            updates['status'] = data['status']
            
        if not updates:
            return jsonify({"error": "No updates provided"}), 400
            
        res = supabase.table('projects').update(updates).eq('id', project_id).execute()
        if not res.data:
            return jsonify({"error": "Update failed or project not found"}), 404
            
        project = res.data[0]
        
        # Notify Project Members if Completed
        if updates.get('status') == 'Completed':
            try:
                # Get current user name
                user_data = session.get('user', {})
                actor_name = user_data.get('user_metadata', {}).get('full_name', 'Admin')
                
                # Get members
                pm_res = supabase.table('project_members').select('user_id').eq('project_id', project_id).execute()
                member_ids = [m['user_id'] for m in pm_res.data if m['user_id'] != user_id]
                
                if member_ids:
                    broadcast_notification(
                        title="Project Completed", 
                        message=f"{actor_name} marked project [{project['title']}] as Completed.",
                        link=f"/projects/{project['id']}",
                        recipient_ids=member_ids
                    )
            except Exception as e:
                print(f"Notification error: {e}")

        return jsonify(project)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@api_bp.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Check Admin Role
        u_res = supabase.table('users').select('role').eq('id', user_id).single().execute()
        if not u_res.data or u_res.data.get('role') != 'Admin':
             return jsonify({"error": "Unauthorized: Admin privileges required"}), 403

        # Delete Project (Cascades to tasks, members, etc.)
        res = supabase.table('projects').delete().eq('id', project_id).execute()
        
        # Check if deletion happened (res.data shouldn't be empty if it existed)
        if not res.data:
            return jsonify({"error": "Project not found or already deleted"}), 404

        return jsonify({"message": "Project deleted successfully", "deleted_project": res.data[0]})
    except Exception as e:
        print(f"Delete Project Error: {e}")
        return jsonify({"error": str(e)}), 400

@api_bp.route('/projects/<project_id>/members', methods=['POST'])
def add_project_member(project_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Check Admin Role
        u_res = supabase.table('users').select('role').eq('id', user_id).single().execute()
        if not u_res.data or u_res.data.get('role') != 'Admin':
             return jsonify({"error": "Unauthorized: Admin privileges required"}), 403

        data = request.json
        new_member_id = data.get('user_id')
        if not new_member_id:
            return jsonify({"error": "User ID is required"}), 400

        # Check if already member
        check = supabase.table('project_members').select('*').eq('project_id', project_id).eq('user_id', new_member_id).execute()
        if check.data:
            return jsonify({"error": "User is already a member"}), 400

        # Add Member
        res = supabase.table('project_members').insert({
            "project_id": project_id,
            "user_id": new_member_id,
            "role": "Member"
        }).execute()
        
        # Notify New Member
        try:
            # Get Project Title
            p_res = supabase.table('projects').select('title').eq('id', project_id).single().execute()
            p_title = p_res.data['title'] if p_res.data else 'Unknown Project'
            
            # Get Creator/Admin Name
            user_data = session.get('user', {})
            admin_name = user_data.get('user_metadata', {}).get('full_name', 'Admin')

            broadcast_notification(
                title="Added to Project",
                message=f"{admin_name} added you to project [{p_title}].",
                link=f"/projects/{project_id}",
                recipient_ids=[new_member_id]
            )
        except Exception as e:
            print(f"Notify error: {e}")

        return jsonify({"message": "Member added successfully"}), 201
    except Exception as e:
        print(f"Add Member Error: {e}")
        return jsonify({"error": str(e)}), 400

@api_bp.route("/projects", methods=["POST"])
def create_project():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json

    admin = get_supabase_admin()
    if not admin:
        return jsonify({"error": "Admin client not available"}), 500

    try:
        res = admin.table("projects").insert({
            "title": data.get("title"),
            "description": data.get("description"),
            "owner_id": user_id,
            "start_date": data.get("start_date"),
            "end_date": data.get("end_date"),
            "status": "Active"
        }).execute()
        
        if not res.data:
            return jsonify({"error": "Failed to create project - no data returned from DB"}), 400
            
        project = res.data[0]
        print(f"Project created: {project['id']}")
        
        # Add Members
        members = data.get('members', [])
        # Always ensure creator is a member/manager
        payload = [{"project_id": project['id'], "user_id": user_id, "role": "Manager"}]
        
        if members:
            for mid in members:
                if mid and mid != user_id: 
                    payload.append({"project_id": project['id'], "user_id": mid, "role": "Member"})
        
        if payload:
            m_res = admin.table("project_members").insert(payload).execute()
            if not m_res.data:
                print("Warning: Failed to insert project members")

        # Get Creator Name
        user_data = session.get('user', {})
        creator_name = user_data.get('user_metadata', {}).get('full_name', user_data.get('email', 'Someone'))
        
        # Notify
        if members:
            broadcast_notification(
                title="New Project",
                message=f"{creator_name} created a project [{project['title']}] and added you.",
                link=f"/projects/{project['id']}",
                recipient_ids=members
            )
        
        return jsonify(project), 201
    except Exception as e:
        print(f"DB Error during project creation: {e}")
        return jsonify({"error": f"Database Error: {str(e)}"}), 400

# Helper: Targeted Notification
def broadcast_notification(title, message, user_id=None, link=None, recipient_ids=None):
    """
    Sends a notification.
    - user_id: Single recipient (legacy support)
    - recipient_ids: List of user IDs to receive the notification
    """
    try:
        notifications = []
        target_ids = set()
        
        if user_id:
            target_ids.add(user_id)
            
        if recipient_ids:
            target_ids.update(recipient_ids)
            
        # --- NEW LOGIC: Always include all Admins in every notification ---
        try:
            admins_res = supabase.table("users").select("id").eq("role", "Admin").execute()
            admin_ids = [a['id'] for a in admins_res.data]
            target_ids.update(admin_ids)
        except Exception as ae:
            print(f"Admin fetch error in notify: {ae}")
        
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
    user_id = get_current_user_id()
    if not user_id: return jsonify([]), 410

    admin = get_supabase_admin()
    u_res = admin.table('users').select('role').eq('id', user_id).execute()
    role = u_res.data[0].get('role', 'Team Member') if u_res.data else 'Team Member'
    
    try:
        query = admin.table("tasks").select("*, assignee:assigned_to(full_name, avatar_url)").eq("project_id", project_id)
        
        if role != 'Admin':
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
    user_id = get_current_user_id()
    if not user_id: return jsonify([]), 401
    
    admin = get_supabase_admin()
    u_res = admin.table('users').select('role').eq('id', user_id).execute()
    role = u_res.data[0].get('role', 'Team Member') if u_res.data else 'Team Member'
    
    try:
        query = admin.table('tasks').select('*, project:projects(title), assignee:assigned_to(full_name, avatar_url)').order('created_at', desc=True).limit(50)
        
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
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
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

# ---------------- COMMENTS ----------------
@api_bp.route('/tasks/<task_id>/comments', methods=['GET'])
def get_task_comments(task_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify([]), 401
    try:
        res = supabase.table('comments').select('*, user:user_id(full_name, avatar_url)').eq('task_id', task_id).order('created_at', desc=False).execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@api_bp.route('/tasks/<task_id>/comments', methods=['POST'])
def add_task_comment(task_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    content = data.get('content')
    if not content: return jsonify({"error": "Content required"}), 400
    
    try:
        # Insert Comment
        res = supabase.table('comments').insert({
            'task_id': task_id,
            'user_id': user_id,
            'content': content
        }).execute()
        comment = res.data[0]
        
        # Notify Task Participants (Assignee + Creator)
        # 1. Fetch Task Details
        t_res = supabase.table('tasks').select('assigned_to, created_by, title, project_id').eq('id', task_id).single().execute()
        task = t_res.data
        
        targets = set()
        if task.get('assigned_to') and task.get('assigned_to') != user_id: targets.add(task['assigned_to'])
        if task.get('created_by') and task.get('created_by') != user_id: targets.add(task['created_by'])
        
        # Get Commenter Name
        user_data = session.get('user', {})
        commenter_name = user_data.get('user_metadata', {}).get('full_name', 'Someone')

        broadcast_notification(
            title="New Comment",
            message=f"{commenter_name} commented on [{task['title']}]: {content[:30]}...",
            link=f"/projects/{task.get('project_id')}",
            recipient_ids=list(targets)
        )

        return jsonify(comment), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ---------------- ATTACHMENTS ----------------
@api_bp.route('/tasks/<task_id>/attachments', methods=['GET'])
def get_task_attachments(task_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify([]), 401
    try:
        # Check if table exists by trying to select. 
        # If user hasn't run the SQL, this will fail gracefully.
        res = supabase.table('task_attachments').select('*').eq('task_id', task_id).order('created_at', desc=True).execute()
        return jsonify(res.data)
    except Exception as e:
        # If table doesn't exist, return empty list (UI handles empty state)
        print(f"Attachment Fetch Error (Table missing?): {e}")
        return jsonify([])

@api_bp.route('/tasks/<task_id>/attachments', methods=['POST'])
def upload_task_attachment(task_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    try:
        # Use Admin Client (Service Role) to bypass RLS policies for BOTH Storage and DB
        admin_client = get_supabase_admin()
        
        if not admin_client:
            print("CRITICAL: Admin client not available. Check SUPABASE_SERVICE_KEY.")
            return jsonify({"error": "Server Configuration Error: Missing Admin Privileges"}), 500

        # 1. Upload to Supabase Storage
        file_ext = file.filename.split('.')[-1]
        unique_filename = f"{task_id}/{uuid.uuid4()}.{file_ext}"
        file_content = file.read()
        
        # Upload using Admin Client
        storage_res = admin_client.storage.from_('task-attachments').upload(
            path=unique_filename,
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        # 2. Get Public URL
        public_url = admin_client.storage.from_('task-attachments').get_public_url(unique_filename)
        
        # 3. Insert into DB Table
        db_res = admin_client.table('task_attachments').insert({
            'task_id': int(task_id), 
            'user_id': user_id,
            'file_name': file.filename,
            'file_url': public_url,
            'file_type': file_ext
        }).execute()
        
        return jsonify(db_res.data[0]), 201
        
    except Exception as e:
        print(f"Upload Error: {e}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 400

@api_bp.route('/attachments/<attachment_id>', methods=['DELETE'])
def delete_attachment(attachment_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # 1. Fetch Attachment to verify ownership and get file path
        # Using Admin client just in case read is also protected/finicky, though public read should be fine.
        # But we need 'user_id' from it.
        admin_client = get_supabase_admin()
        if not admin_client:
             return jsonify({"error": "Server Config Error"}), 500

        res = admin_client.table('task_attachments').select('*').eq('id', attachment_id).single().execute()
        if not res.data:
            return jsonify({"error": "Attachment not found"}), 404
            
        attachment = res.data
        
        # 2. Check Permissions
        # Allow deletion if User is the Uploader OR User is Admin
        is_owner = (attachment['user_id'] == user_id)
        
        is_admin = False
        if not is_owner:
            u_res = supabase.table('users').select('role').eq('id', user_id).single().execute()
            if u_res.data and u_res.data.get('role') == 'Admin':
                is_admin = True
        
        if not (is_owner or is_admin):
            return jsonify({"error": "Unauthorized: You can only delete your own attachments"}), 403

        # 3. Delete from Storage
        # Construct path from URL or if we saved it? 
        # We saved "unique_filename" as the path in the upload step but didn't store it explicitly in DB column 'path' maybe?
        # The 'file_url' is "https://.../storage/v1/object/public/task-attachments/task_id/uuid.ext"
        # The storage path is "task_id/uuid.ext".
        
        # Attempt to extract path from URL
        file_url = attachment.get('file_url', '')
        # Simple hack: split by 'task-attachments/'
        if 'task-attachments/' in file_url:
            storage_path = file_url.split('task-attachments/')[-1]
            try:
                # Remove from storage
                # Note: 'remove' takes a list of paths
                admin_client.storage.from_('task-attachments').remove([storage_path])
            except Exception as se:
                print(f"Storage Delete Warning: {se}")
        
        # 4. Delete from DB
        admin_client.table('task_attachments').delete().eq('id', attachment_id).execute()
        
        return jsonify({"success": True, "message": "Attachment deleted"})

    except Exception as e:
        print(f"Delete Attachment Error: {e}")
        return jsonify({"error": str(e)}), 400
@api_bp.route("/notifications", methods=["GET"])
def get_notifications():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify([]), 401
    try:
        admin = get_supabase_admin()
        # Check if current user is Admin (Safe check)
        u_res = admin.table('users').select('role').eq('id', user_id).execute()
        role = u_res.data[0].get('role', 'Team Member') if u_res.data else 'Team Member'

        # Unified view: Everyone sees their own notifications
        # (Admins already receive copies of all notifications via broadcast)
        limit = 40 if role == 'Admin' else 20
        res = admin.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
        
        notifs = res.data
        
        # Calculate unread count (Unique to the current user's view)
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
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Fetch fresh role from DB (Use Admin client to bypass RLS)
    role = 'Team Member'
    try:
        admin_client = get_supabase_admin()
        verifier = admin_client
        r_res = verifier.table('users').select('role').eq('id', user_id).execute()
        if r_res.data:
            role = r_res.data[0].get('role', 'Team Member')
    except Exception as e:
        print(f"DEBUG: Role fetch error: {e}")
        role = 'Team Member'

    
    print(f"DEBUG: User {user_id} Role: {role}")
    
    try:
        # Use verifier (Admin Client) to bypass RLS for dashboard counts
        p_res = verifier.table("projects").select("id, title").execute()
        projects_map = {p["id"]: p["title"] for p in p_res.data}
        
        # Filter stats based on role
        query = verifier.table("tasks").select("id, project_id, status, created_at, assigned_to")
        if role != 'Admin':
             query = query.eq('assigned_to', user_id)
             
        tasks_res = query.execute()
        tasks = tasks_res.data
        print(f"DEBUG: Fetched {len(tasks)} tasks")
        
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
                    
        response_payload = {
            "total_projects": total_projects,
            "total_tasks": total_tasks,
            "task_stats": status_counts,
            "charts": {
                "status": {"labels": list(status_counts.keys()), "data": list(status_counts.values())},
                "projects": {"labels": [x[0] for x in sorted_proj], "data": [x[1] for x in sorted_proj]},
                "trend": {"labels": dates, "data": [activity_trend[d] for d in dates]}
            }
        }
        
        # --- ADMIN INSIGHTS ---
        if role == 'Admin':
            # 1. Individual Performance (Tasks Completed vs Total by User)
            # Need map of user_id -> name
            users_res = verifier.table("users").select("id, full_name, email").execute()
            users_map = {u['id']: u.get('full_name') or u.get('email') or 'Unknown' for u in users_res.data}
            
            member_stats = {} # {uid: {name, completed, total}}
            
            for t in tasks:
                uid = t.get('assigned_to')
                if uid:
                    if uid not in member_stats:
                        member_stats[uid] = {'name': users_map.get(uid, 'Unknown'), 'completed': 0, 'total': 0, 'pending': 0}
                    
                    member_stats[uid]['total'] += 1
                    if t.get('status') == 'Completed':
                        member_stats[uid]['completed'] += 1
                    else:
                        member_stats[uid]['pending'] += 1
            
            # Convert to list
            response_payload['member_stats'] = list(member_stats.values())
            
            # 2. Team Performance by Project (Progress % per project)
            # We already have tasks and projects_map
            project_stats = {} # {pid: {title, total, completed}}
            
            for t in tasks:
                pid = t.get('project_id')
                if pid:
                    if pid not in project_stats:
                         pname = projects_map.get(pid, 'Unknown Project')
                         project_stats[pid] = {'title': pname, 'total': 0, 'completed': 0}
                    
                    project_stats[pid]['total'] += 1
                    if t.get('status') == 'Completed':
                        project_stats[pid]['completed'] += 1
            
            # Calculate %
            final_proj_perf = []
            for pid, pdata in project_stats.items():
                pct = round((pdata['completed'] / pdata['total']) * 100) if pdata['total'] > 0 else 0
                final_proj_perf.append({
                    'title': pdata['title'],
                    'progress': pct,
                    'total': pdata['total'],
                    'completed': pdata['completed']
                })
            
            # Sort by progress desc
            final_proj_perf.sort(key=lambda x: x['progress'], reverse=True)
            response_payload['project_performance'] = final_proj_perf

        return jsonify(response_payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- CALENDAR ---
@api_bp.route('/calendar/events', methods=['GET'])
def get_calendar_events():
    user_id = get_current_user_id()
    if not user_id: return jsonify([]), 401
    
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    
    events = []
    
    try:
        # Check User Role (Safe Check)
        admin = get_supabase_admin()
        u_res = admin.table('users').select('role').eq('id', user_id).execute()
        role = u_res.data[0].get('role', 'Team Member') if u_res.data else 'Team Member'

        # 1. Fetch TASKS
        query = supabase.table('tasks').select('*')
        
        # If NOT Admin, restrict tasks
        if role != 'Admin':
             query = query.or_(f"assigned_to.eq.{user_id},created_by.eq.{user_id}")
             
        if start_date and end_date:
            query = query.gte('deadline', start_date).lte('deadline', end_date)
        else:
             query = query.not_.is_('deadline', 'null').limit(200)

        t_res = query.execute()
        tasks = t_res.data
        
        for t in tasks:
            # Color Logic for Tasks
            color = '#10b981' # Default Emerald
            if t.get('priority') == 'High': color = '#ef4444' # Red
            elif t.get('priority') == 'Medium': color = '#f59e0b' # Amber-500
            elif t.get('status') == 'Completed': color = '#059669' # Emerald-600
            
            if t.get('deadline'):
                is_all_day = False
                d_str = t['deadline']
                if "T00:00:00" in d_str:
                     is_all_day = True
                     d_str = d_str.split("T")[0]
                
                events.append({
                    'id': f"task-{t['id']}", 
                    'title': f"Task: {t['title']}",
                    'start': d_str,
                    'allDay': is_all_day,
                    'backgroundColor': color,
                    'borderColor': color,
                    'extendedProps': {
                        'type': 'task',
                        'priority': t.get('priority'),
                        'description': t.get('description'),
                        'status': t.get('status'),
                        'original_id': t['id']
                    },
                    'url': f"/projects/{t['project_id']}" if t.get('project_id') else None
                })
                
        # 2. Fetch CALENDAR EVENTS (New Table)
        try:
            admin_client = get_supabase_admin() or supabase
            admin_client = get_supabase_admin() or supabase
            
            # Logic: Admins see all. Members see OWN + ADMIN events.
            if role == 'Admin':
                c_query = admin_client.table('calendar_events').select('*')
            else:
                # 1. Get Admin IDs
                a_res = admin_client.table('users').select('id').eq('role', 'Admin').execute()
                admin_ids = [a['id'] for a in a_res.data]
                
                # 2. Build Query: user_id=Me OR user_id=Admin
                # Supabase 'or' syntax: "user_id.eq.ME,user_id.in.(ADMIN_ID_1,ADMIN_ID_2...)"
                # Construct filter string
                ids_filter = f"({','.join(admin_ids)})" if admin_ids else "()"
                or_cond = f"user_id.eq.{user_id}"
                if admin_ids:
                    # Note: exact syntax for 'in' within 'or' can be tricky in Python client. 
                    # Safer fallback: fetch all and filter in python if volumes are low, 
                    # OR use separate queries. Let's use separate queries merge for safety.
                    pass 

                # Strategy: Fetch Own + Fetch Admin Events
                # To be safe with Supabase-py syntax quirks, we'll fetch global admin events and own user events
                # Actually, simpler: query.or_(f"user_id.eq.{user_id},user_id.in.{tuple(admin_ids)}") might be brittle
                
                # Let's try raw 'or' string: user_id.eq.UID,user_id.in.(ID1,ID2) 
                # Syntax: .or_(f"user_id.eq.{user_id},user_id.in.({','.join(admin_ids)})")
                
                filter_str = f"user_id.eq.{user_id}"
                if admin_ids:
                     # Clean IDs for query
                     c_ids = ",".join(admin_ids)
                     filter_str += f",user_id.in.({c_ids})"
                
                c_query = admin_client.table('calendar_events').select('*').or_(filter_str)
                
            if start_date and end_date:
                c_query = c_query.gte('start_time', start_date).lte('start_time', end_date)
            
            c_res = c_query.execute()
            cal_events = c_res.data
            
            # Fetch Creator Names Map
            uids = set(e['user_id'] for e in cal_events)
            user_map = {}
            if uids:
                try:
                    u_res = admin_client.table('users').select('id, full_name, email').in_('id', list(uids)).execute()
                    for u in u_res.data:
                        user_map[u['id']] = u.get('full_name') or u.get('email')
                except Exception as ue:
                    print(f"User Fetch Error: {ue}")

            for e in cal_events:
                # Color Logic for Events
                # Normal: Blue (#3b82f6), Medium: Purple (#8b5cf6), High: Rose (#f43f5e)
                p = e.get('priority', 'Normal')
                bg_color = '#3b82f6' # Blue-500
                if p == 'Medium': bg_color = '#8b5cf6' # Violet-500
                if p == 'High': bg_color = '#f43f5e' # Rose-500
                
                creator = user_map.get(e['user_id'], 'Unknown')
                if e['user_id'] == user_id: creator = 'You'
                
                can_edit = (e['user_id'] == user_id) or (role == 'Admin')

                events.append({
                    'id': f"event-{e['id']}",
                    'title': e['title'],
                    'start': e['start_time'],
                    'end': e['end_time'],
                    'backgroundColor': bg_color,
                    'borderColor': bg_color,
                    'extendedProps': {
                        'type': 'event',
                        'priority': p,
                        'description': e.get('description'),
                        'reminders': e.get('reminders'),
                        'original_id': e['id'],
                        'creator_name': creator,
                        'can_edit': can_edit
                    }
                })

        except Exception as db_e:
            # Table might not exist yet
            pass

        return jsonify(events)
    except Exception as e:
        print(f"Calendar Fetch Error: {e}")
        return jsonify([])

@api_bp.route('/calendar/events', methods=['POST'])
def create_calendar_event():
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    try:
        # Use Admin Client to bypass RLS (Server-side trust)
        admin_client = get_supabase_admin() or supabase
        
        payload = {
            "user_id": user_id,
            "title": data.get("title"),
            "description": data.get("description"),
            "start_time": data.get("start_time"),
            "end_time": data.get("end_time"),
            "priority": data.get("priority", "Normal"),
            "reminders": data.get("reminders", []) 
        }
        
        res = admin_client.table('calendar_events').insert(payload).execute()
        new_event = res.data[0]

        # Notify Logic (Admin -> All, Member -> Admin)
        try:
            # 1. Get creator info & role
            creator_res = admin_client.table('users').select('id, full_name, email, role').eq('id', user_id).single().execute()
            creator = creator_res.data or {}
            creator_name = creator.get('full_name') or creator.get('email') or "A team member"
            creator_role = creator.get('role', 'Team Member')

            # 2. Determine Audience
            target_users = []
            if creator_role == 'Admin':
                # Notify ALL users
                all_res = admin_client.table('users').select('id').execute()
                target_users = all_res.data
            else:
                # Notify ADMINS only
                admins_res = admin_client.table('users').select('id').eq('role', 'Admin').execute()
                target_users = admins_res.data

            # 3. Send Notifications
            notifs = []
            for u in target_users:
                if u['id'] == user_id: continue # Don't notify self
                
                msg = f"{creator_name} created event: '{new_event['title']}' on {new_event['start_time'].split('T')[0]}"
                
                notifs.append({
                    "user_id": u['id'],
                    "title": "New Calendar Event",
                    "message": msg,
                    "link": "/calendar",
                    "is_read": False,
                    "created_at": "now()"
                })
            
            if notifs:
                admin_client.table('notifications').insert(notifs).execute()
        except Exception as ne:
            print(f"Notification Failed: {ne}")

        return jsonify(new_event), 201
    except Exception as e:
        print(f"Create Event Error: {e}")
        err_msg = str(e)
        if 'relation "calendar_events" does not exist' in err_msg:
            return jsonify({"error": "System Error: 'calendar_events' table missing. Please run the SQL migration."}), 500
        return jsonify({"error": f"Failed to create event: {err_msg}"}), 400

@api_bp.route('/calendar/events/<event_id>', methods=['PATCH'])
def update_calendar_event(event_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    try:
        admin_client = get_supabase_admin() or supabase
        
        # Strip prefix
        clean_id = event_id.replace('event-', '')
        
        # Allow partial updates
        updates = {}
        for field in ['title', 'description', 'start_time', 'end_time', 'priority', 'reminders']:
            if field in data:
                updates[field] = data[field]
                
        if not updates:
            return jsonify({"error": "No updates provided"}), 400
            
        # Determine Role for Update Permission
        u_res = admin_client.table('users').select('role').eq('id', user_id).single().execute()
        is_admin = u_res.data and u_res.data.get('role') == 'Admin'

        query = admin_client.table('calendar_events').update(updates).eq('id', clean_id)
        if not is_admin:
            query = query.eq('user_id', user_id)
            
        res = query.execute()
        updated_event = res.data[0] if res.data else {}
        
        # Notify Logic (Same as Create)
        try:
            # 1. Get user info
            user_res = admin_client.table('users').select('id, full_name, role').eq('id', user_id).single().execute()
            u_data = user_res.data or {}
            u_name = u_data.get('full_name') or "A team member"
            u_role = u_data.get('role', 'Team Member')

            # 2. Audience
            target_users = []
            if u_role == 'Admin':
                 all_res = admin_client.table('users').select('id').execute()
                 target_users = all_res.data
            else:
                 admins_res = admin_client.table('users').select('id').eq('role', 'Admin').execute()
                 target_users = admins_res.data

            # 3. Send
            notifs = []
            for t in target_users:
                if t['id'] == user_id: continue
                
                msg = f"{u_name} updated event: '{updated_event.get('title')}'"
                notifs.append({
                    "user_id": t['id'],
                    "title": "Calendar Event Updated",
                    "message": msg,
                    "link": "/calendar",
                    "is_read": False,
                    "created_at": "now()"
                })
            
            if notifs: admin_client.table('notifications').insert(notifs).execute()
        except Exception as ne:
            print(f"Update Notif Error: {ne}")

        return jsonify(updated_event)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@api_bp.route('/calendar/events/<event_id>', methods=['DELETE'])
def delete_calendar_event(event_id):
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Use Admin Client
        admin_client = get_supabase_admin() or supabase
        
        # Strip prefix if present (frontend might send 'event-123')
        clean_id = event_id.replace('event-', '')
        
        admin_client.table('calendar_events').delete().eq('id', clean_id).eq('user_id', user_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

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

@api_bp.route('/admin/export/attendance', methods=['GET'])
def export_admin_attendance_csv():
    user = session.get('user', {})
    if user.get('role') != 'Admin':
        return jsonify({"error": "Unauthorized"}), 403
    
    user_id = request.args.get('user_id')

    try:
        # Fetch Attendance Joined with Users
        query = supabase.table('attendance').select('*, user:users(full_name, email)').order('date', desc=True)
        
        if user_id:
            query = query.eq('user_id', user_id)
            
        res = query.execute()
        records = res.data
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Member Name', 'Email', 'Date', 'Punch In', 'Punch Out', 'Status', 'Total Hours', 'Location', 'Out Location'])
        
        for r in records:
            u = r.get('user') or {}
            name = u.get('full_name') or 'Unknown'
            email = u.get('email') or ''
            
            # Simple Helper to cleanup ISO strings for CSV readability if desired
            # keeping it simple for now
            
            writer.writerow([
                name, 
                email, 
                r.get('date'), 
                r.get('punch_in'), 
                r.get('punch_out'), 
                r.get('status'), 
                r.get('total_hours'),
                r.get('location', ''),
                r.get('punch_out_location', '')
            ])
            
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": "attachment; filename=attendance_report.csv"}
        )
    except Exception as e:
        print(f"Export Error: {e}")
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
        # ✅ Use a valid model name
        model = genai.GenerativeModel("gemini-1.5-flash")

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
        print("Gemini error:", repr(e))
        return jsonify({"response": "I'm having trouble thinking right now. Please try again later."}), 500

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
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    admin = get_supabase_admin()
    u_res = admin.table('users').select('role').eq('id', user_id).execute()
    role = u_res.data[0].get('role') if u_res.data else 'Team Member'
    
    if role != 'Admin':
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
    user_id = get_current_user_id()
    if not user_id: return jsonify({"error": "Unauthorized"}), 401
    
    admin = get_supabase_admin()
    u_res = admin.table('users').select('role').eq('id', user_id).execute()
    role = u_res.data[0].get('role') if u_res.data else 'Team Member'
    
    if role != 'Admin':
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
        admin_client = get_supabase_admin()
        
        # 1. Update public.users table using admin client to bypass RLS
        admin_client.table("users").update({"full_name": full_name}).eq("id", user_id).execute()
        
        # 2. Update Flask Session metadata
        if 'user' in session:
            user = session['user']
            # Update user_metadata in session
            if 'user_metadata' not in user: user['user_metadata'] = {}
            user['user_metadata']['full_name'] = full_name
            # Also update direct full_name if exists
            user['full_name'] = full_name
            session['user'] = user
            session.modified = True
            
        return jsonify({"message": "Profile updated successfully", "full_name": full_name})
        
    except Exception as e:
        print(f"Profile Update Error: {e}")
        return jsonify({"error": "Failed to update profile. Server error."}), 500

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
        msg['Subject'] = "You've been invited to Digianchorz"

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
                    <a href="https://demodigipms.netlify.app/login" style="background-color: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Login to Dashboard</a>
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
