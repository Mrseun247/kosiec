# KOSIEC Full-Stack Website
## Kogi State Independent Electoral Commission

---

## Tech Stack
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+) — Multi-file, modular
- **Backend:** Node.js + Express.js
- **Database:** MongoDB Atlas (Mongoose ODM)
- **File Storage:** Cloudinary (cloud-hosted images & documents — chairman photo, gallery, PDFs, etc.)
- **Auth:** JWT (JSON Web Tokens) + bcryptjs password hashing (12 salt rounds)
- **Security:** Account lockout after 5 failed logins (30-min cooldown), full admin login/activity audit log
- **Email:** Nodemailer (for contact form notifications)

---

## Project Structure

```
kosiec-full/
├── backend/
│   ├── config/
│   │   ├── db.js               # MongoDB Atlas connection
│   │   └── cloudinary.js       # Cloudinary cloud storage connection
│   ├── middleware/
│   │   ├── auth.js             # JWT verification middleware
│   │   ├── upload.js           # Multer + Cloudinary storage adapter
│   │   └── errorHandler.js     # Global error handler
│   ├── models/
│   │   ├── User.js             # Admin / Staff / Voter users — bcrypt-hashed passwords, lockout fields
│   │   ├── AdminLog.js         # Login & admin activity audit log
│   │   ├── Election.js         # Elections (Chairmanship / Councillorship)
│   │   ├── Result.js           # Official election results per LGA
│   │   ├── Candidate.js        # Candidates per election
│   │   ├── NewsArticle.js      # News, press releases, notices
│   │   ├── TeamMember.js       # Staff & commissioners — chairman photo via Cloudinary
│   │   ├── SharedModels.js     # Event, Download, GalleryItem, Inquiry, Testimonial, Setting
│   │   └── LGA.js              # LGA master list (all 21 Kogi LGAs)
│   ├── routes/
│   │   ├── auth.js             # Login / register / logout / change-password / activity logs
│   │   ├── elections.js        # CRUD elections
│   │   ├── results.js          # CRUD election results
│   │   ├── candidates.js       # CRUD candidates
│   │   ├── news.js             # CRUD news articles
│   │   ├── team.js             # CRUD team members + dedicated chairman photo upload
│   │   ├── lgas.js             # GET LGA list
│   │   └── sharedRoutes.js     # Events, Downloads, Gallery, Inquiries, Testimonials, Settings
│   ├── .env.example            # Environment variable template (fill in your real values)
│   ├── .gitignore
│   ├── package.json
│   ├── seed.js                 # Seeds LGAs, admin accounts, chairman record, settings
│   └── server.js                # Express app entry point
└── frontend/
    ├── index.html               # Main app shell (all pages, routed client-side)
    ├── css/
    │   └── main.css             # Design system: variables, typography, shared components
    ├── js/
    │   ├── api.js                # Centralized API client (fetch wrapper for every endpoint)
    │   └── router.js             # Client-side routing + Auth state management
    └── pages/
        └── pages.js              # All page loaders (home, results, news, team, admin, etc.)
```

---

## Setup Instructions

### 1. MongoDB Atlas
1. Go to https://cloud.mongodb.com and open your cluster (`Cluster0`).
2. Database Access → confirm your database user `mrseun007_db_user` exists, and **note its password** (set/reset it there if you don't have it — this is different from your Atlas login password).
3. Network Access → add your IP, or `0.0.0.0/0` for development/testing.
4. Your connection string will be:
   ```
   mongodb+srv://mrseun007_db_user:<db_password>@cluster0.bwe6b1x.mongodb.net/kosiec?appName=Cluster0
   ```
   Replace `<db_password>` with the real password. If it contains special characters (`@ : / ? #` etc.), URL-encode them (e.g. `@` → `%40`).

### 2. Cloudinary
1. Go to https://cloudinary.com/console — your dashboard shows an **API Environment Variable** in the format:
   ```
   cloudinary://<api_key>:<api_secret>@<cloud_name>
   ```
2. Copy that exact string into `CLOUDINARY_URL` in your `.env` file.
3. All uploaded photos (including the Chairman's photo) and documents will automatically be stored in organized Cloudinary folders: `kosiec/team`, `kosiec/gallery`, `kosiec/news`, `kosiec/documents`, `kosiec/parties`.

### 3. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env — fill in MONGODB_URI, CLOUDINARY_URL, JWT_SECRET, EMAIL_PASS
npm run seed        # First time only — seeds LGAs, admin accounts, chairman record
npm run dev          # Development (nodemon, auto-restart)
npm start            # Production
```

### 4. Frontend
- Open `frontend/index.html` directly in a browser, OR
- Serve with any static file server:
```bash
cd frontend
npx serve .
```
- Update `API_BASE` at the top of `frontend/js/api.js` to your deployed backend URL when going to production.

---

## Environment Variables (.env)
See `backend/.env.example` for the full annotated template. Key values:

| Variable | Description |
|---|---|
| `MONGODB_URI` | Your MongoDB Atlas connection string (with real password) |
| `CLOUDINARY_URL` | Your Cloudinary credentials, format `cloudinary://key:secret@cloud_name` |
| `JWT_SECRET` | Long random string — used to sign login tokens |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail address + App Password for contact-form email notifications |

**Never commit your real `.env` file.** It's already excluded via `.gitignore`.

---

## Security Features

- **Password hashing:** bcryptjs with 12 salt rounds — passwords are never stored or logged in plain text.
- **Account lockout:** after 5 consecutive failed login attempts, an account is locked for 30 minutes. A super_admin can manually unlock early via `PUT /api/auth/users/:id/unlock`.
- **Admin activity log:** every login (success/failure), logout, password change, account lock/unlock, and admin create/update/delete action is recorded in the `AdminLog` collection with timestamp, IP address, and user agent. View it in the Admin Panel under "Admin Activity Log", or query directly via `GET /api/auth/logs`.
- **Rate limiting:** login endpoint capped at 10 attempts per 15 minutes per IP; contact form capped at 5 submissions per hour per IP; general API capped at 200 requests per 15 minutes per IP.

---

## API Base URL
All endpoints are prefixed with `/api/`. Example: `http://localhost:5000/api/news`

---

## Default Admin Accounts
After running `npm run seed`:

| Account | Email | Password | Role |
|---|---|---|---|
| Super Admin | `admin@kosiec.gov.ng` | `Kosiec@2026` | super_admin |
| Chairman | `erimamman2@gmail.com` | `Kosiec@Chairman2026` | admin |

**Change both passwords immediately after first login** via `PUT /api/auth/change-password`.

---

## Uploading the Chairman's Photo

Once the backend is running and you're logged in as an admin, upload the chairman's photo (Mamman Nda Eri) via:

```
PUT /api/team/:id/photo
Authorization: Bearer <your_jwt_token>
Content-Type: multipart/form-data
Body: photo = <image file>
```

Or simply use the **Admin Panel → Dashboard → Chairman Photo** upload box in the frontend — it's wired to this endpoint already. The photo uploads directly to Cloudinary and the URL is saved to the chairman's `TeamMember` record automatically.
