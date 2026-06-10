# SecureShield AI: Enterprise Adaptive Multi-Factor Authentication and Threat Detection Platform

SecureShield AI is an advanced full-stack cybersecurity platform designed to protect financial, enterprise, and high-security web applications using a state-of-the-art **Five-Layer Adaptive Security Model**. 

The system leverages behavioral biometrics, computer vision, geofencing, and artificial intelligence to evaluate sign-in risk in real-time, enforcing friction or security locks adaptively.

---

## 🛠️ Architecture & Technology Stack

- **Frontend**: React.js, Vite, TypeScript, Tailwind CSS, Framer Motion, Recharts, TensorFlow.js (Blazeface).
- **Backend**: Node.js, Express.js, TypeScript, MVC Architecture, Winston Logger, Zod validator, Helmet.
- **Data & Caching**: MongoDB with Mongoose, Redis.
- **DevOps & Monitoring**: Docker & Docker Compose, Prometheus metrics, GitHub Actions CI/CD workflows.

---

## 🔒 The Five-Layer Adaptive Security Engine

1. **Argon2 Credentials & Breached Check**: Hashes credentials with Argon2id. Automatically checks the password hash against the HaveIBeenPwned API to flag leaked credentials.
2. **Behavioral Biometrics**: Measures keyboard dwell/flight times and mouse move coordinate trajectories (speed, curvature, hand jitter) to distinguish between humans and automated coordinate stuffing bots.
3. **Multi-Channel OTP & Backups**: Delivers verification codes via Email (Nodemailer SMTP) or SMS (Twilio/Fast2SMS). Generates hashed static backup codes for emergency bypass.
4. **Biometric Face Liveness**: Uses client-side TensorFlow.js Blazeface model to estimate face landmarks, verify eye-blinking liveness, and block photo-spoofing attacks.
5. **Contextual Geofencing & Impossible Travel**: Measures GPS coordinate distance against safe zones (Haversine formula). Tracks velocity between consecutive sessions to trigger "impossible travel" alerts (e.g., login from NY and Berlin within 15 minutes).

---

## 📁 Repository Directory Structure

```
├── backend/
│   ├── src/
│   │   ├── config/       # Databases (Mongo, Redis) and file-based fallback mockDb
│   │   ├── controllers/  # Auth, Admin, Security Analyst business logics
│   │   ├── middlewares/  # JWT auth, Role RBAC, Rate-limiting, Zod request checks
│   │   ├── models/       # Mongoose schemas (User, Session, Alerts, Logs)
│   │   ├── routes/       # Endpoint routers mapping controllers
│   │   ├── services/     # Biometric calculations, geofence check, threat scoring
│   │   └── server.ts     # Server entrypoint
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/   # Unified glassmorphism components
│   │   ├── hooks/        # Keystroke trackers and mouse drag collectors
│   │   ├── views/        # Multistep login flow, user/admin console views
│   │   ├── utils/        # TFJS Blazeface blink estimator and device fingerprinting
│   │   └── App.tsx       # State engine page router
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml    # Main orchestration configuration
├── prometheus.yml        # Metrics scraping configuration
└── README.md             # This document
```

---

## 🚀 Quick Start Setup Guide

### Prerequisites
Make sure you have [Node.js (v18+)](https://nodejs.org/) and [NPM](https://www.npmjs.com/) installed on your machine.

> [!NOTE]
> **No Database? No Problem!**
> SecureShield is built with database resilience. If MongoDB or Redis is not running locally on your system, the server will **automatically fall back to a file-based JSON DB** (`backend/mock_db_data/`) and in-memory caches. It will run out-of-the-box without manual setups!

---

### Step 1: Install Dependencies
Run `npm install` inside both directories:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install --legacy-peer-deps
```

---

### Step 2: Seed Test Accounts
Populate the database with preconfigured credentials (Admin, Security Analyst, User roles):

```bash
cd ../backend
npm run seed
```

This creates the default user accounts in either MongoDB or your mock database files.

---

### Step 3: Run the Servers
Open two terminal windows to run the development servers:

#### Terminal 1 (Backend API)
```bash
cd backend
npm run dev
```
Starts backend API on: [http://localhost:4173](http://localhost:4173)

#### Terminal 2 (React Frontend)
```bash
cd frontend
npm run dev
```
Starts frontend UI on: [http://localhost:5173](http://localhost:5173)

---

## 🔑 Default Test Credentials

Use these accounts to evaluate RBAC and dashboards:

| Username | Password | Role | Access Level |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin` | **Admin** | Full system policy sliders, user overrides, unlocking accounts, incident feed |
| **`analyst`** | `AnalystPassword123!` | **SecurityAnalyst** | Read-only policies, resolves threat incident alerts, logs history |
| **`user_demo`** | `UserPassword123!` | **User** | Interactive active sessions logout, emergency backup codes |

---

## 🐳 Docker Deployment (Optional)

Compile and build all services in single-network containers:

```bash
# Launch MongoDB, Redis, Prometheus, Backend and Frontend
docker-compose up --build
```

- **Frontend Application**: [http://localhost](http://localhost)
- **Backend API**: [http://localhost:4173](http://localhost:4173)
- **Swagger Documentation**: [http://localhost:4173/api-docs](http://localhost:4173/api-docs)
- **Prometheus Dashboard**: [http://localhost:9090](http://localhost:9090)
