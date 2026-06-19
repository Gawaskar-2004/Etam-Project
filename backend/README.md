# ETAM Backend — Node.js + MySQL

Education Time & Attendance Management System  
**Converted from Supabase → Node.js + Express + MySQL**

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js              # MySQL connection pool
│   │   └── migrate.js         # Run schema migration
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── institutionController.js
│   │   ├── branchController.js
│   │   ├── academicController.js
│   │   ├── studentController.js
│   │   ├── staffController.js
│   │   ├── subjectController.js
│   │   ├── timetableController.js
│   │   ├── attendanceController.js
│   │   ├── leaveController.js
│   │   └── uploadController.js
│   ├── middleware/
│   │   └── auth.js            # JWT authentication
│   ├── routes/
│   │   └── index.js           # All API routes
│   └── server.js              # Express app entry point
├── uploads/                   # Uploaded images stored here
├── schema.sql                 # MySQL database schema
├── frontend-api-client.js     # Drop-in replacement for Supabase in React
├── package.json
└── .env.example
```

---

## 🚀 Setup Instructions

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MySQL credentials
```

### 3. Create MySQL database & run schema
```bash
# Option A - Auto migrate
npm run migrate

# Option B - Manual (run in MySQL Workbench or CLI)
mysql -u root -p < schema.sql
```

### 4. Start the server
```bash
npm run dev    # Development (with nodemon)
npm start      # Production
```

Server runs at: **http://localhost:5000**

---

## 🔗 Frontend Integration

### Step 1 — Add environment variable to your React project
In your React project root, create/edit `.env`:
```
VITE_API_URL=http://localhost:5000/api
```

### Step 2 — Copy the API client
Copy `frontend-api-client.js` to your React project:
```
src/lib/api.js
```

### Step 3 — Replace Supabase imports
**Before (Supabase):**
```js
import { supabase } from '@/lib/supabase'
const { data } = await supabase.from('students').select('*')
```

**After (Node.js API):**
```js
import { students } from '@/lib/api'
const data = await students.list()
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register admin + institution |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/me | Update profile |
| PUT | /api/auth/change-password | Change password |

### Institution
| Method | Endpoint |
|--------|----------|
| GET | /api/institutions/me |
| PUT | /api/institutions/me |

### Branches
| Method | Endpoint |
|--------|----------|
| GET | /api/branches |
| POST | /api/branches |
| PUT | /api/branches/:id |
| DELETE | /api/branches/:id |

### Academic Structure
| Method | Endpoint |
|--------|----------|
| GET/POST | /api/academic/labels |
| GET/POST | /api/academic/categories |
| GET/POST | /api/academic/subcategories |
| GET/POST | /api/academic/items |
| POST | /api/academic/copy |

### Students
| Method | Endpoint |
|--------|----------|
| GET | /api/students?branch_id=&category_id=&search= |
| POST | /api/students |
| PUT | /api/students/:id |
| DELETE | /api/students/:id |
| GET | /api/students/:id/attendance-summary |

### Staff
| Method | Endpoint |
|--------|----------|
| GET | /api/staff |
| POST | /api/staff |
| PUT | /api/staff/:id |
| DELETE | /api/staff/:id |
| GET | /api/staff/:id/workload |

### Subjects
| Method | Endpoint |
|--------|----------|
| GET | /api/subjects |
| POST | /api/subjects |
| PUT/DELETE | /api/subjects/:id |
| POST | /api/subjects/:id/assign-staff |

### Timetable
| Method | Endpoint |
|--------|----------|
| GET/POST | /api/periods |
| GET/POST | /api/timetable |
| GET/POST | /api/timetable-assignments |
| GET/POST | /api/class-teachers |

### Attendance
| Method | Endpoint |
|--------|----------|
| GET/POST | /api/attendance/settings |
| GET/POST | /api/attendance/sessions |
| GET/POST | /api/attendance/sessions/:id/records |
| PUT | /api/attendance/records/:id |
| GET | /api/attendance/statistics |
| GET | /api/attendance/daily-summary |

### Leave Requests
| Method | Endpoint |
|--------|----------|
| GET | /api/leave-requests |
| POST | /api/leave-requests |
| PUT | /api/leave-requests/:id/approve |
| PUT | /api/leave-requests/:id/reject |
| DELETE | /api/leave-requests/:id |

### File Upload
| Method | Endpoint |
|--------|----------|
| POST | /api/upload (multipart/form-data, field: "file") |

---

## 🔐 Authentication

All endpoints (except register/login) require a JWT token:
```
Authorization: Bearer <token>
```

The token is returned from `/api/auth/login` and `/api/auth/register`.

### Roles
- **admin** — Full access
- **teacher** — Can mark attendance, view students
- **student** — View own records
- **staff** — Limited access
