# Kolhapuri Khanawal OS — Production Deployment Guide

This guide details how to deploy the **Kolhapuri Khanawal Restaurant Operating System** to **Vercel** and **Firebase Hosting**.

---

## 1. Pre-Deployment Configuration

The project is pre-configured with the production credentials for Firebase project `kolhapuri-khanawal`:

### Environment Variables (`.env.local` & `.env.production`)
```env
# Firebase Web App Credentials
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyBjg1aUq7UZCbUy1QhE-cuIsJCA_qOWXHw"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="kolhapuri-khanawal.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="kolhapuri-khanawal"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="kolhapuri-khanawal.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="411458352091"
NEXT_PUBLIC_FIREBASE_APP_ID="1:411458352091:web:df9c228a995a18cb0cadfe"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-QY2NE6C18L"

# Restaurant Operational Settings
NEXT_PUBLIC_RESTAURANT_NAME="Kolhapuri Khanawal"
NEXT_PUBLIC_DEFAULT_TIMEZONE="Asia/Kolkata"
NEXT_PUBLIC_CURRENCY="INR"
```

---

## 2. Deploying to Vercel (Recommended for Next.js App Router)

Vercel natively optimizes Next.js App Router, SSR, Turbopack, and the `/api/print/network` printing endpoint.

### Step 1: Login to Vercel CLI
```bash
vercel login
```
*(Select your preferred login method: GitHub, GitLab, Bitbucket, or Email)*

### Step 2: Link Project & Set Environment Variables
```bash
# Link the project to your Vercel account
vercel link
```

When prompted:
- Set up and deploy: **Yes**
- Which scope: *(Select your personal or team account)*
- Link to existing project: **No** (or link if created on dashboard)
- Project name: `kolhapuri-khanawal-os`
- In which directory is your code located: `./`

### Step 3: Deploy to Production
```bash
vercel --prod
```
The Vercel CLI will build and deploy the app directly to your production URL:
`https://kolhapuri-khanawal-os.vercel.app`

---

## 3. Deploying to Firebase Hosting

The project is linked to Firebase project `kolhapuri-khanawal` via `.firebaserc` and `firebase.json`.

### Step 1: Login to Firebase CLI
```bash
npx firebase-tools login
```
*(Or if you are on a remote server/SSH: `npx firebase-tools login --no-localhost`)*

### Step 2: Verify Project Selection
```bash
npx firebase-tools projects:list
npx firebase-tools use kolhapuri-khanawal
```

### Step 3: Deploy Hosting
```bash
# Enable Next.js web frameworks experiment if needed:
npx firebase-tools experiments:enable webframeworks

# Deploy Hosting
npx firebase-tools deploy --only hosting
```

Your live Firebase domains will be:
- **`https://kolhapuri-khanawal.web.app`**
- **`https://kolhapuri-khanawal.firebaseapp.com`**

---

## 4. Local Build & Test Verification

Before pushing to production, run the local quality checks:

```bash
# 1. Type Safety Check
npm run typecheck

# 2. Automated Test Suite (25 suites, 165 tests)
npm run test

# 3. Production Build Compilation
npm run build

# 4. Preview Production Build Locally
npm start
```
