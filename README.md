# MediPath: Hospital Navigation & Management System

MediPath is a comprehensive, full-stack hospital navigation and management system designed to streamline indoor routing, doctor availability tracking, and patient feedback. It features a robust Role-Based Access Control (RBAC) system and a Guest-first experience for public hospital visitors.

## Key Features

- **Indoor Navigation**: SVG-based indoor routing system with QR code integration for instant origin detection.
- **Doctor Board**: Real-time tracking of doctor availability and current status (Available, Busy, In Surgery, etc.) powered by WebSockets.
- **Guest-First Landing**: The application defaults to a public-facing dashboard, allowing visitors to navigate and view hospital info without logging in.
- **Mandatory Patient Feedback**: A feedback system with sentiment analysis that requires a Patient ID / OP Number for verified reporting.
- **Schedule Management**: Shift and appointment scheduling for doctors and nurses, with department-scoped management for HoDs and Coordinators.
- **Role-Based Access Control (RBAC)**: Detailed permission tiers for Admins, HoDs, Coordinators, Doctors, Nurses, and Guests.

## Technology Stack

- **Frontend**: 
    - HTML5 & CSS3 (Custom responsive implementation)
    - Vanilla JavaScript (Single-page application logic)
- **Backend**: 
    - Node.js & Express.js
    - WebSockets (ws) for real-time status updates
    - JWT (JSON Web Tokens) for secure authentication
- **Database**: 
    - SQL.js (SQLite implementation for Node.js)

## Project Structure

```text
MediPath/
├── public/             # Frontend assets
│   ├── css/            # Custom style tokens and UI components
│   ├── js/             # Modular JS components (api, navigation, feedback, schedules, etc.)
│   └── index.html      # Main application entry
├── server/             # Backend application
│   ├── middleware/     # Auth, RBAC, and department-scoping logic
│   ├── routes/         # API endpoints for Navigation, Doctors, Feedback, Schedules
│   ├── database.js     # SQL.js initialization, schema, and seed data
│   └── index.js        # Express server entry point
└── medipath.sqlite     # Project database
```

## Setup & Installation

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run the Application**:
    ```bash
    npm start
    ```

3.  **Access the App**:
    Open your browser and navigate to `http://localhost:3000`.

## Demo Logins

- **Admin**: `admin / admin123`
- **HoD (Medicine)**: `hod.med / hod123`
- **Coordinator**: `coord.med / coord123`
- **Doctor**: `dr.kumar / doc123`
- **Patient**: `patient1 / pat123`

---


