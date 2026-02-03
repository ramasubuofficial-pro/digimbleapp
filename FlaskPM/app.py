from flask import Flask, request, jsonify
from config import Config
from routes.auth_routes import auth_bp
from routes.view_routes import view_bp
from routes.api_routes import api_bp
import re

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Init CORS (Robust RegEx for Mobile/Ngrok/Netlify)
    from flask_cors import CORS
    CORS(app, 
         supports_credentials=True, 
         origins=[
             re.compile(r"^https?://localhost(:\d+)?$"),
             re.compile(r"^https?://.*\.ngrok-free\.dev$"),
             re.compile(r"^https?://.*\.netlify\.app$"),
             "https://demodigipms.netlify.app",
             "https://digianchorzdemo.onrender.com",
             "http://localhost",
             "capacitor://localhost"
         ],
         allow_headers=["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
         methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])

    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        if origin:
            print(f"  [CORS] Handshake with {origin}")
        return response

    @app.before_request
    def log_request_info():
        # Enhanced Logging to help debug mobile connectivity
        origin = request.headers.get('Origin', 'No Origin')
        print(f"--- [{request.method}] {request.path} from {origin} ---")
        if 'Authorization' not in request.headers:
            print("  (!) Missing Authorization Header")
        else:
            print("  (✓) Authorization Header Present")

    @app.route('/api/ping')
    def ping():
        return jsonify({"status": "online", "message": "Backend is reachable!"})

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(view_bp)
    app.register_blueprint(api_bp)

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
        # Ensure CORS headers are set for credentials
        # response.headers['Access-Control-Allow-Credentials'] = 'true' 
        # (CORS library handles this usually, but good to check if issues persist)
        return response

    # Check session on every request
    @app.before_request
    def check_user_active():
        # Skip static assets, auth routes, and API requests with Bearer tokens
        if request.method == 'OPTIONS':
            return
            
        if not request.endpoint or 'static' in request.endpoint or 'auth.' in request.endpoint:
            return
        
        if request.endpoint == 'view_bp.login':
            return

        # If it's an API call with an Authorization header, let api_routes handle it
        if request.headers.get('Authorization'):
            return

        # Check if session exists but user is deleted from DB
        if 'user' in session:
            user_id = session.get('user', {}).get('id')
            if user_id:
                try:
                    # Use Admin Client to check existence (bypass RLS)
                    from utils import get_supabase_admin
                    admin = get_supabase_admin()
                    if admin:
                        res = admin.table('users').select('id').eq('id', user_id).execute()
                        if not res.data:
                            print(f"User {user_id} not found in DB. Forcing logout.")
                            session.clear()
                            if '/api/' in request.path:
                                 from flask import jsonify
                                 return jsonify({"error": "User record deleted"}), 401
                            return redirect(url_for('view_bp.login'))
                except Exception as e:
                    print(f"Session check error: {e}")

    # Reverse Geocode API (OSM Fallback)
    import requests
    from flask import request, jsonify

    # Reverse Geocode API (OSM Fallback) - Zoom 18
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
            "zoom": 18,
            "addressdetails": 1
        }

        try:
            r = requests.get(url, params=params, headers=headers, timeout=6)
            data = r.json()
            addr = data.get("address", {})

            # Extract highly granular parts (PagarBook style)
            # Priority: House/Building -> Specific Place (Shop, College) -> Road -> Area -> City
            
            house_number = addr.get("house_number")
            
            # Specific place names
            place_name = (
                addr.get("amenity") 
                or addr.get("building") 
                or addr.get("shop") 
                or addr.get("office") 
                or addr.get("leisure")
                or addr.get("tourism")
                or addr.get("name") # Generic name fallback
            )
            
            road = addr.get("road")
            
            suburb = (
                addr.get("neighbourhood")
                or addr.get("suburb")
                or addr.get("residential")
                or addr.get("quarter")
                or addr.get("hamlet")
                or addr.get("locality")
                or addr.get("city_district")
            )
            
            city_town = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("municipality")
            )
            
            district = (
                addr.get("state_district")
                or addr.get("city_district")
                or addr.get("county")
            )
            
            state = addr.get("state")
            postcode = addr.get("postcode")

            # Build list with specific header parts first
            parts = []
            if postcode: parts.append(postcode)
            if suburb: parts.append(suburb)
            if city_town: parts.append(city_town)
            if district and district != city_town: parts.append(district)
            if state: parts.append(state)
            
            # If we want to keep more details if available but later in the string
            # if place_name: parts.append(place_name)
            # if road: parts.append(road)

            # Deduplicate preserving order
            seen = set()
            clean_parts = []
            for p in parts:
                if p and p.lower() not in seen:
                    clean_parts.append(p)
                    seen.add(p.lower())

            location = ", ".join(clean_parts)

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
        
    app.run(debug=True, host='0.0.0.0', port=5000)
