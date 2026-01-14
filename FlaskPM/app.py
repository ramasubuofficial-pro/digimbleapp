from flask import Flask
from config import Config
from routes.auth_routes import auth_bp
from routes.view_routes import view_bp
from routes.api_routes import api_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(view_bp)
    app.register_blueprint(api_bp)

    # Inject config into all templates
    # Inject config into all templates
    @app.context_processor
    def inject_config():
        return dict(config=app.config)

    # Global Session Verification
    from flask import session, request, redirect, url_for
    from utils import supabase

    @app.route('/favicon.ico')
    def favicon():
        return "", 204

    @app.after_request
    def add_header(response):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

    # Check session on every request
    @app.before_request
    def check_user_active():
        # Skip static assets and auth routes (to allow login/logout)
        if not request.endpoint or 'static' in request.endpoint or 'auth.' in request.endpoint:
            return
        
        # If accessing the login page itself, don't loop
        if request.endpoint == 'view_bp.login':
            return

        # Check if session exists but user is deleted from DB
        if 'user' in session:
            user_id = session.get('user', {}).get('id')
            if user_id:
                try:
                    # Check if user exists in public.users table
                    res = supabase.table('users').select('id').eq('id', user_id).execute()
                    if not res.data:
                        print(f"User {user_id} not found in DB. Forcing logout.")
                        session.clear()
                        return redirect(url_for('view_bp.login'))
                except Exception as e:
                    print(f"Session check error: {e}")
                    # Optional: Force logout on error to be safe? 
                    # For now, let's allow ensuring it's not a temp glitch.

    # Reverse Geocode API (OSM Fallback)
    import requests
    from flask import request, jsonify

    @app.route("/api/reverse-geocode")
    def reverse_geocode():
        lat = request.args.get("lat")
        lon = request.args.get("lon")

        headers = {
            "User-Agent": "DIGIANCHORZ-Attendance/1.0 (contact@digianchorz.com)"
        }

        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "format": "json",
            "lat": lat,
            "lon": lon,
            "zoom": 19,
            "addressdetails": 1,
            "extratags": 1
        }

        try:
            r = requests.get(url, params=params, headers=headers, timeout=6)
            data = r.json()
            addr = data.get("address", {})

            # ✅ INDIA-OPTIMIZED AREA RESOLUTION
            area = (
                addr.get("suburb")
                or addr.get("neighbourhood")
                or addr.get("residential")
                or addr.get("quarter")
                or addr.get("city_district")
                or addr.get("county")
                or addr.get("village")
                or addr.get("road")
                or ""
            )

            city = (
                addr.get("city")
                or addr.get("town")
                or addr.get("municipality")
                or addr.get("county")
                or ""
            )

            state = addr.get("state") or ""

            # Deduplicate
            if area == city:
                area = ""

            parts = [area, city, state]
            location = ", ".join([p for p in parts if p])

            if location:
                return jsonify({"location": location})

        except Exception as e:
            print("Reverse geo error:", e)

        return jsonify({"location": f"{lat}, {lon}"})

    return app

app = create_app()

if __name__ == "__main__":
    import os
    from scheduler import start_scheduler
    
    # Ensure scheduler only runs once (in the reloader process)
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        start_scheduler()
        
    app.run(debug=True, port=5000)
