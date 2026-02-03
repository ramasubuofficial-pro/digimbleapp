from flask import Blueprint, redirect, url_for, session, request, render_template, jsonify
from utils import supabase, get_supabase_admin
import requests
from config import Config

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login')
def login():
    return redirect("/login")

@auth_bp.route('/google')
def google_auth():
    # Redirect to Supabase Google Auth (simplified for this demo, usually handled via frontend or direct link)
    # Since we are using Supabase, it provides a built-in auth URL.
    # However, for a strict Flask + Supabase OAuth flow, we might handle the callback.
    # For simplicity, we'll assume the client-side Supabase Auth or a direct redirect.
    
    # Actually, the user prompt says "Google OAuth 2.0 for authentication... On first login: Create user record".
    # Supabase handles this automatically if we use their Auth. 
    # Let's rely on client-side Supabase Auth for the initial login to get the JWT, 
    # then send that to the server to set the session, OR use server-side OAuth flow.
    # Given the strict requirement for "Flask backend", we'll implement a route that initiates the flow
    # but Supabase Python client is mostly for data. Supabase GoTrue (Auth) is often easier on client-side.
    # But let's try server-side redirect if possible or just render the login page with the button.
    
    return render_template('login.html') # The login page will handle the actual button click/redirect.

@auth_bp.route('/callback')
def auth_callback():
    # In a real app, Supabase redirects here with an access token in the hash (client-side) 
    # or code (server-side) depending on flow.
    # Since Supabase default is implicit/PKCE for client, we often process it on client and then POST to server to set a session cookie.
    return render_template('auth_callback.html')

@auth_bp.route('/api/set-session', methods=['POST'])
def set_session():
    data = request.json
    access_token = data.get('access_token')
    user_data = data.get('user')
    
    if access_token and user_data:
        user_id = user_data.get('id')
        email = user_data.get('email')
        full_name = user_data.get('user_metadata', {}).get('full_name', '')
        avatar_url = user_data.get('user_metadata', {}).get('avatar_url', '')

        try:
            # STRICT AUTH CHECK:
            # User must ALREADY exist in public.users (via Invite) to log in.
            admin_client = get_supabase_admin()
            if not admin_client:
                 return jsonify({"error": "Configuration Error"}), 500
            
            # 1. Check by ID first
            existing = admin_client.table('users').select('id, role, full_name, email').eq('id', user_id).execute()
            
            # 2. If not found by ID, check by Email (First time login after invite)
            if not existing.data and email:
                print(f"Auth: Checking for email invite for {email}")
                existing = admin_client.table('users').select('id, role, full_name, email').eq('email', email).execute()
                
                if existing.data:
                    # Found by email! Link this ID to the record now.
                    print(f"Auth: Linking email invite to ID {user_id}")
                    admin_client.table('users').update({'id': user_id}).eq('email', email).execute()

            if not existing.data:
                # User not found in DB -> Was not invited or was deleted.
                print(f"Login Rejected: {email} ({user_id}) not found in invitations list.")
                return jsonify({
                    "error": "Access Denied. You are not on the permitted member list. Please contact the Admin.",
                    "redirect": "/login"
                }), 403
            
            # --- User is Valid ---
            record = existing.data[0]
            db_role = record.get('role', 'Member')
            db_name = record.get('full_name')

            # Update details (Avatar/Name) but keep Role
            update_payload = {
                'email': email,
                'avatar_url': avatar_url
            }
            if not db_name and full_name:
                update_payload['full_name'] = full_name
            elif db_name:
                user_data['user_metadata']['full_name'] = db_name # Session uses DB name
                user_data['full_name'] = db_name

            # Update details (Avatar/Email) using admin client
            admin_client.table('users').update(update_payload).eq('id', user_id).execute()

            # Set Session
            user_data['role'] = db_role
            session['user'] = user_data
            session['access_token'] = access_token
            
            return jsonify({"status": "success"}), 200

        except Exception as e:
            print(f"Error syncing user: {e}")
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "Invalid payload"}), 400

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect("/login")
