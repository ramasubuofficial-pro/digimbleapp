from flask import Blueprint, render_template, session, redirect, url_for
from utils import supabase

view_bp = Blueprint('views', __name__)

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

@view_bp.route('/')
@login_required
def dashboard():
    user_id = session['user']['id']
    
    # Fetch user role safely
    try:
        user_res = supabase.table('users').select('role').eq('id', user_id).execute()
        user_role = user_res.data[0]['role'] if user_res.data else 'Team Member'
    except Exception:
        user_role = 'Team Member'
    
    return render_template('dashboard.html', user=session['user'], role=user_role)

@view_bp.route('/tasks')
@login_required
def tasks():
    return render_template('tasks.html', user=session['user'])

@view_bp.route('/projects')
@login_required
def projects():
    return render_template('projects.html', user=session['user'])

@view_bp.route('/calendar')
@login_required
def calendar():
    return render_template('calendar.html', user=session['user'])

@view_bp.route('/projects/<project_id>')
@login_required
def project_details(project_id):
    return render_template('project_details.html', user=session['user'], project_id=project_id)

@view_bp.route('/settings')
@login_required
def settings():
    return render_template('settings.html', user=session['user'])

@view_bp.route('/reports')
@login_required
def reports():
    return render_template('reports.html', user=session['user'])

@view_bp.route('/team')
@login_required
def team():
    return render_template('team.html', user=session['user'])

@view_bp.route('/attendance')
@login_required
def attendance():
    return render_template('attendance.html', user=session['user'])
