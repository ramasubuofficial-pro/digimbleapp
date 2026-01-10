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
    @app.context_processor
    def inject_config():
        return dict(config=app.config)

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
