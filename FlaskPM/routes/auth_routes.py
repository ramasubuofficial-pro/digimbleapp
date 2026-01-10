from flask import Blueprint, redirect, url_for, session, request, render_template
from utils import supabase
import requests
from config import Config

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login')
def login():
    # If already logged in, redirect to dashboard
    if 'user' in session:
        return redirect(url_for('views.dashboard'))
    return render_template('login.html')

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
        session['user'] = user_data
        session['access_token'] = access_token
        
        # Check if user exists in our public.users table, if not create them
        user_id = user_data.get('id')
        email = user_data.get('email')
        full_name = user_data.get('user_metadata', {}).get('full_name', '')
        avatar_url = user_data.get('user_metadata', {}).get('avatar_url', '')

        try:
            # Upsert user to ensure they exist in our custom table
            # We use upsert to handle both new and existing users smoothly
            user_payload = {
                'id': user_id,
                'email': email,
                'full_name': full_name,
                'avatar_url': avatar_url,
                # 'role': 'Team Member' - Don't overwrite role on login if it exists!
                # Upsert without role update if possible? 
                # Supabase upsert overwrites all fields provided.
                # Use a check if you want to preserve role, or just upsert basic info.
            }
            
            # First check if user exists to preserve role
            existing = supabase.table('users').select('role').eq('id', user_id).execute()
            
            db_role = 'Team Member'
            
            if not existing.data:
                user_payload['role'] = 'Team Member'
                supabase.table('users').insert(user_payload).execute()
            else:
                db_role = existing.data[0].get('role', 'Team Member')
                # Update info but keep role
                supabase.table('users').update({
                    'email': email,
                    'full_name': full_name,
                    'avatar_url': avatar_url
                }).eq('id', user_id).execute()
            
            # CRITICAL: Update the session user object with the APP role, not just Auth role
            session_user = session['user']
            session_user['role'] = db_role 
            session['user'] = session_user # Re-assign to ensure session saves
                
        except Exception as e:
            print(f"Error syncing user: {e}")
                
        except Exception as e:
            print(f"Error syncing user: {e}")

        return {"status": "success"}, 200
    return {"status": "error"}, 400

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))
