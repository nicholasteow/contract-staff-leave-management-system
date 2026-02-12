# Contract Staff Leave Management System

A government agency needs to streamline the leave management process for contract staff, ensuring accurate tracking of chargeable and non-chargeable leaves, and automated billing reconciliation.

## 🚀 Quick Start (5 Minutes)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/nicholasteow/contract-staff-leave-management-system.git
cd contract-staff-leave-management-system

# 2. Install dependencies
npm install

# 3. Start the development server
npm start
```

The app will open at `http://localhost:3000`

---

## 🔐 Demo Accounts

Use these accounts to test all roles immediately:

| Role | Email | Password |
|------|-------|----------|
| Contract Staff | staff@test.com | password123 |
| Manager | manager@test.com | password123 |
| Finance Officer | finance@test.com | password123 |

**No Firebase configuration needed** – the app connects to the live demo database automatically.

---

## 🔧 Custom Firebase Setup (Optional)

To use your own Firebase project instead of the live demo:

### 1. Create Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com/)
- Click "Add project" and follow wizard

### 2. Enable Services
- **Authentication** → Sign-in method → Enable Email/Password
- **Firestore Database** → Create database → Start in production mode

### 3. Register Web App
- Click `</>` (Web) icon
- Register app name
- Copy Firebase config object

### 4. Configure Environment
Create `.env` file in root directory:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### 5. Create Demo Users
In Firebase Auth, manually create:
- `staff@test.com` / `password123`
- `manager@test.com` / `password123`
- `finance@test.com` / `password123`

### 6. Add User Profiles
In Firestore, create `users` collection with documents matching the schema above.

---

## 🚢 Deployment (Firebase Hosting)

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Initialize hosting
firebase init hosting
# - Select your project
# - Public directory: build
# - Single-page app: Yes
# - Overwrite index.html: No

# 4. Build and deploy
npm run build
firebase deploy --only hosting
```

Your live URL: `https://your-project-id.web.app`

---

## 📊 Documentation Index

| Document | Location | Description |
|----------|----------|-------------|
| User Stories | `/docs/user-stories/user-stories.md` | Detailed requirements by role |
| Wireframes | `/docs/wireframes/` | Low-fidelity prototype images |
| System Architecture | Word Document | Tech stack and data flow |
| Reconciliation Logic | Word Document| Billing calculation methodology |
| Test Cases | Word Document | 3 scenarios with expected results |
| Setup Instructions | This README | Local and production deployment |

---

