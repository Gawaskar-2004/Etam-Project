# ETAM - Education Time & Attendance Management
## Complete Project (Frontend + Backend)

---

## FOLDER STRUCTURE
```
etam-project/
├── backend/      ← Node.js + Express + MySQL server
└── frontend/     ← React + Vite frontend
```

---

## HOW TO RUN

### STEP 1 - Start Backend
Open PowerShell in the `backend` folder and run:
```
npm install
node src/server.js
```
Backend runs at: http://localhost:5000

### STEP 2 - Start Frontend
Open a NEW PowerShell in the `frontend` folder and run:
```
npm install
npm run dev
```
Frontend runs at: http://localhost:5173

---

## MYSQL SETUP (only once)
Make sure MySQL is running, then the backend will auto-create the database.

Backend .env file is already configured with:
- DB_HOST=localhost
- DB_PORT=3306
- DB_USER=root
- DB_PASSWORD=Gawas@2004
- DB_NAME=etam_db

If your MySQL password is different, edit: `backend/.env`

---

## USAGE
1. Open http://localhost:5173 in your browser
2. Click "Register here" to create your institution
3. Complete the 3-step setup (Branch → Location → Academic)
4. Login and use the system!
