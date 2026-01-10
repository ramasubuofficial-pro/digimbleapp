# Antigravity PM Tool

A professional, web-based Project Management Tool built with Flask, Supabase, and Tailwind CSS.

## Features

- **Role-Based Access**: Admin, Project Manager, Team Member roles.
- **Projects & Tasks**: Create, manage, and track projects and tasks.
- **Kanban Board**: Interactive task board with drag-and-drop feel.
- **Real-time Updates**: AJAX-based UI for smooth experience.
- **Modern UI**: Clean, glassmorphic design using Tailwind CSS.
- **Google Authentication**: Secure login via Supabase Auth.

## Setup Instructions

### 1. Prerequisites

- Python 3.8+
- Node.js (for Tailwind cDN or tooling if expanded, though current setup uses CDN)
- A Supabase Project

### 2. Database Setup

1. Go to your Supabase Dashboard -> SQL Editor.
2. Run the contents of `schema.sql` to create the necessary tables.
3. Establish your Authentication providers (Google) in Supabase Auth settings.

### 3. Environment Variables

1. Copy `.env.example` to `.env`.
2. Fill in your Supabase URL, Key, and Google OAuth credentials.
   - `SUPABASE_URL`: Your project URL.
   - `SUPABASE_KEY`: Your 'anon' public key.
   - `SECRET_KEY`: A random string for Flask sessions.

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Run the Application

```bash
python app.py
```

Visit `http://localhost:5000` to start.

## Project Structure

- `app.py`: Main application entry point.
- `config.py`: Configuration loading.
- `utils.py`: Database client helper.
- `routes/`: Modular route definitions for Auth, Views, and API.
- `templates/`: HTML templates with Tailwind classes.
- `static/`: JS and CSS assets.
