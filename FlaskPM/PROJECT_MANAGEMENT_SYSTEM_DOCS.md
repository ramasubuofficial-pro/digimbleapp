# Project Management System Documentation

## Table of Contents
1.  [Project Overview](#1-project-overview)
2.  [Introduction](#2-introduction)
3.  [System Overview](#3-system-overview)
4.  [Features & Functionalities](#4-features--functionalities)
5.  [Non-Functional Requirements](#5-non-functional-requirements)
6.  [Technology Stack](#6-technology-stack)
7.  [System Requirements](#7-system-requirements)
8.  [System Architecture](#8-system-architecture)
9.  [Database Design](#9-database-design)
10. [Use Case Descriptions](#10-use-case-descriptions)
11. [Security Considerations](#11-security-considerations)
12. [Testing Strategy](#12-testing-strategy)
13. [Future Enhancements](#13-future-enhancements)
14. [Conclusion](#14-conclusion)

---

## 1. Project Overview

### Project Name
**Project Management System (PMS)**

### Project Type
**Web-based Application** with support for Desktop (via Electron wrapper) and Mobile (via PWA/Capacitor).

### Target Users
*   **Admins**: System administrators and team leads who create projects, assign tasks, manage users, and view global reports.
*   **Team Members**: Individual contributors who work on tasks, update statuses, and log attendance.

---

## 2. Introduction

### Purpose of the System
The Project Management System is designed to streamline the workflow of software development and operational teams. It provides a centralized platform for task tracking, team collaboration, and attendance management, replacing fragmented tools and spreadsheets with a single, unified solution.

### Objectives
*   To facilitate efficient project planning and execution.
*   To enable real-time collaboration and communication among team members.
*   To provide transparent monitoring of individual and team performance.
*   To automate administrative tasks such as attendance tracking and reporting.

### Scope of the Project
The system covers the end-to-end lifecycle of project management from project initiation to closure. It includes:
*   User Management & Role-Based Access Control (RBAC).
*   Project & Task Management.
*   Real-time Notifications.
*   Attendance & Location Tracking.
*   Reporting & Analytics.

### Problem Statement
Organizations often struggle with miscommunication, missed deadlines, and lack of visibility into team activities due to decentralized management tools. Existing solutions may be too complex, expensive, or lack specific features like integrated attendance. This system aims to solve these issues by offering a tailored, user-friendly, and cost-effective solution.

---

## 3. System Overview

### System Description
The PMS is a full-stack web application built using a **modern, scalable, and modular architecture**. It features a responsive React-based frontend for a dynamic user experience and a robust Python Flask backend for logic and API management. Data is secured and managed using PostgreSQL (via Supabase), ensuring reliability and scalability.

### User Roles and Responsibilities
*   **Admin**:
    *   Invite and manage users.
    *   Create and edit projects.
    *   Create tasks and assign them to members.
    *   Access all projects and tasks.
    *   View comprehensive attendance and performance reports.
    *   Configure system settings.
*   **Team Member**:
    *   View assigned tasks.
    *   Update task status (e.g., To Do -> In Progress -> Completed).
    *   Add comments to tasks.
    *   Punch in/out for attendance.

### Workflow Explanation
1.  **Onboarding**: Admin invites a user via email. The user logs in using Google OAuth.
2.  **Project Initiation**: Admin creates a new project and adds members.
3.  **Task Execution**: Admin adds tasks to the project. Members receive notifications.
4.  **Work Tracking**: Members update task status and add comments as they work.
5.  **Monitoring**: Admin views dashboards to track progress and attendance.

---

## 4. Features & Functionalities

### User Authentication & Authorization
*   **Secure Login**: Integrated Google OAuth via Supabase for secure, password-less authentication.
*   **Strict Access Control**: Only users invited by an Admin can log in, preventing unauthorized access.
*   **Session Management**: Secure server-side session handling using Flask.

### Project Creation & Management
*   **CRUD Operations**: Create, Read, Update, and Delete projects.
*   **Status Tracking**: Mark projects as Active, On Hold, Completed, or Archived.
*   **Timeline**: Set start and end dates for projects.

### Task Assignment & Tracking
*   **Detailed Tasks**: Create tasks with titles, descriptions, priorities (Low, Medium, High), and due dates.
*   **Kanban/List View**: Visualize tasks based on their status (To Do, In Progress, Completed).
*   **Assignment**: Assign tasks to specific team members who receive instant alerts.
*   **Task Viewing**: Quick read-only view of task details via the "Eye" icon or task title click.
*   **Task Management**: Comprehensive edit mode for modifying task details, managing attachments, or removing tasks with a secure confirmation modal.

### Team Collaboration Features
*   **Comments**: Integrated commenting system on tasks for discussions.
*   **File Sharing**: Upload and download attachments (images, documents) directly within tasks.
*   **Team View**: View all team members and their current availability.

### Progress Monitoring & Reporting
*   **Admin Dashboard**: High-level view of system statistics (Total Projects, Tasks, Active Users).
*   **Performance Metrics**: Track task completion rates and on-time delivery.
*   **Attendance Reports**: Admin-exclusive reports on employee work hours and punch times.

### Notifications & Alerts
*   **Real-time Alerts**: Notifications for new task assignments and status changes.
*   **Visual Indicators**: Badge counters for unread notifications.

### Attendance System
*   **Punch In/Out**: One-click attendance logging.
*   **Location Tracking**: Captures user location during punch-in for verification.
*   **Work Hours**: Automatically calculates total hours worked per day.

---

## 5. Non-Functional Requirements

### Security
*   **Authentication**: OAuth 2.0 (Google) ensures industry-standard login security.
*   **Data Protection**: All sensitive data is stored in a secure PostgreSQL database.
*   **Access Control**: Middleware ensures APIs are protected based on user roles.

### Performance
*   **Frontend**: Built with Vite and React for lightning-fast page loads and smooth transitions.
*   **Backend**: Flask API is lightweight and optimized for quick response times.

### Scalability
*   **Database**: PostgreSQL is highly scalable, capable of handling thousands of records.
*   **Architecture**: Cloud-ready architecture (Docker/Render compatible) allows for easy horizontal scaling.

### Reliability
*   **Uptime**: Designed for 24/7 availability with error handling and logging.
*   **Data Integrity**: ACID-compliant database transactions ensure data consistency.

### Usability
*   **UI/UX**: Modern, clean interface designed with Tailwind CSS.
*   **Responsiveness**: Fully responsive design works on Desktops, Tablets, and Mobile devices.

---

## 6. Technology Stack

### Frontend Technologies
*   **Framework**: React.js (v18+)
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS
*   **Icons**: React Icons / Lucide React
*   **State Management**: React Hooks (Context API)

### Backend Technologies
*   **Language**: Python 3.9+
*   **Framework**: Flask (Microframework)
*   **Authentication**: Supabase Auth (integrated with Flask Session)
*   **Utilities**: `requests`, `python-dotenv`

### Database
*   **DBMS**: PostgreSQL (hosted via Supabase)
*   **ORM/Driver**: `supabase-py` / `psycopg2` (or direct API calls)
*   **Schema**: Relational model with Foreign Keys.

### APIs and Tools
*   **REST API**: Custom built API endpoints for frontend-backend communication.
*   **Leaflet.js**: For map and location visualization in Attendance.

### Version Control
*   **Git**: Source code management.
*   **GitHub**: Repository hosting.

### Hosting / Deployment
*   **Web**: Render / Vercel / Netlify.
*   **Desktop**: Electron (wrapper around web app).
*   **Mobile**: PWA / Capacitor.

---

## 7. System Requirements

### Hardware Requirements
*   **RAM**: Minimum 4 GB RAM (8 GB Recommended).
*   **Processor**: Dual-core processor or higher.
*   **Network**: Stable Internet connection.

### Software Requirements
*   **Browser**: Modern web browser (Google Chrome, Microsoft Edge, Firefox, Safari).
*   **Runtime Environments**: Node.js (v18+) and Python (v3.9+).
*   **Database**: PostgreSQL-compatible database server.

---

## 8. System Architecture

### High-level Architecture
The system follows a typical **Client-Server Architecture**:
1.  **Client (Frontend)**: React application running in the user's browser. It makes HTTP requests to the backend API.
2.  **Server (Backend)**: Flask application processing requests, executing business logic, and enforcing security.
3.  **Database layer**: Supabase (PostgreSQL) storing persistent data.

### Client-Server Interaction
*   **Format**: JSON-based communication.
*   **Method**: RESTful principles (GET, POST, PUT, DELETE).
*   **Flow**: User Action -> Frontend Request -> Flask Route -> Database Query -> Response -> Frontend Update.

---

## 9. Database Design

### Entity Descriptions
*   **Users**: Stores user profile and authentication details.
*   **Projects**: Stores high-level project information.
*   **Tasks**: Stores actionable items linked to projects.
*   **Comments**: Stores discussions related to tasks.
*   **Attendance**: Stores daily work logs.

### Key Tables and Attributes

**1. users**
*   `id` (UUID, PK): Unique identifier.
*   `email` (Text): User email.
*   `role` (Enum): 'Admin', 'Team Member'.

**2. projects**
*   `id` (UUID, PK): Unique identifier.
*   `title` (Text): Project name.
*   `status` (Enum): 'Active', 'Completed', etc.
*   `owner_id` (UUID, FK): Reference to `users`.

**3. tasks**
*   `id` (UUID, PK): Unique identifier.
*   `project_id` (UUID, FK): Reference to `projects`.
*   `assigned_to` (UUID, FK): Reference to `users`.
*   `status` (Enum): 'To Do', 'In Progress', 'Completed'.

**4. attendance**
*   `id` (UUID, PK): Unique identifier.
*   `user_id` (UUID, FK): Reference to `users`.
*   `punch_in` (Timestamp): Start time.
*   `punch_out` (Timestamp): End time.

### Entity Relationships
*   One **User** can manage multiple **Projects**.
*   One **Project** can contain multiple **Tasks**.
*   One **Task** can have multiple **Comments**.
*   One **User** can have multiple **Attendance** records.

---

## 10. Use Case Descriptions

### Admin Use Cases
*   **UC-01**: Admin logs in via Google Auth.
*   **UC-02**: Admin invites a new user by adding them to the database.
*   **UC-03**: Admin views "System Health" report.
*   **UC-04**: Admin exports monthly attendance sheets.
*   **UC-05**: Admin creates a new project "Website Redesign".
*   **UC-06**: Admin creates a task "Design Homepage" and assigns it to a designer.
*   **UC-07**: Admin marks a project as "Completed".
*   **UC-11**: Admin edits task details (e.g., changes priority or deadline).
*   **UC-12**: Admin deletes a task after confirmation.

### Team Member Use Cases
*   **UC-08**: Member sees notification "New Task Assigned".
*   **UC-09**: Member logs in and clicks "Punch In".
*   **UC-10**: Member updates task status to "In Progress".
*   **UC-13**: User views task details in a read-only modal.
*   **UC-14**: User downloads an attachment from a task.

---

## 11. Security Considerations

### Authentication Mechanisms
The system strictly relies on **Server-Side Validation** of the user session. Even if a user authenticates via Google on the frontend, the backend validates the token and checks if the user exists in the `users` table before granting a session.

### Data Protection
*   Role-Based access control ensures Team Members cannot see Admin data.
*   UUIDs are used for all Primary Keys to prevent ID enumeration attacks.

---

## 12. Testing Strategy

### Unit Testing
*   Testing individual API routes (e.g., ensuring `GET /api/projects` returns the correct JSON format).
*   Testing utility functions (e.g., date formatting, hour calculation).

### Integration Testing
*   Testing the flow between Frontend and Backend (e.g., clicking "Login" and verifying the session is created on the server).
*   Testing Database constraints (e.g., trying to assign a task to a non-existent user).

### User Acceptance Testing (UAT)
*   Real-world testing by users to ensure the workflow (Create Project -> Add Task -> Complete Task) is intuitive and bug-free.

---

## 13. Future Enhancements

### Possible Improvements
*   **Mobile App Notifications**: Push notifications for the mobile version.
*   **Calendar Integration**: Sync tasks with Google Calendar / Outlook.
*   **Dark Mode**: Native support for dark theme.

### Advanced Features
*   **Gantt Charts**: Visual timeline for project management.
*   **Resource Allocation**: Tools to prevent overworking specific team members.

---

## 14. Conclusion
The **Project Management System** is a robust, scalable, and secure solution tailored for modern teams. By combining a high-performance React frontend with a logical Flask backend, it solves the core problems of task tracking and team coordination. Its clean architecture and strict security measures make it suitable for academic presentation and real-world deployment alike.
