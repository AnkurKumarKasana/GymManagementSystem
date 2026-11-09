# EliteEdge Gym Management

A production-oriented gym management web application built with React, TypeScript, Tailwind CSS, and Firebase. The project includes a working dashboard, member management flow, attendance scanning, payment tracking, reporting, and settings configuration in a single admin interface.

## Architecture

- Frontend: React + TypeScript + Vite + Tailwind CSS
- UI/UX: dark premium dashboard, mobile-first responsive layout
- Authentication: Firebase Auth (with local fallback demo admin mode when Firebase is not configured)
- Database: Firestore with a `gyms/{gymId}/...` hierarchy
- Storage: Firebase Storage for member photos and QR assets
- Business logic: implemented directly within the app state layer and service-ready Firebase config

## Quick Start

1. Clone the repo and install dependencies:
   npm install
2. Copy `.env.example` to `.env` and add your Firebase project values.
3. Start the app:
   npm run dev -- --host

## Firebase Setup

- Create a Firebase project.
- Enable Email/Password authentication.
- Enable Firestore and Storage.
- Add the values from `.env.example` to your `.env` file.
- Deploy rules:
   firebase deploy --only firestore:rules,storage

## Firestore Structure

The app expects a structure similar to:

```
gyms/
  {gymId}/
    members/
    memberships/
    attendance/
    payments/
    plans/
    notifications/
    settings/
```

## Security Notes

- Admin-only access is enforced in the provided Firestore and Storage rule files.
- No Firebase Admin credentials should be placed in frontend code.
- The app uses a secure token model for QR attendance, never plain private member data.

## Recommended Next Steps

- Connect the app to real Firestore collections.
- Replace local demo storage with production Firestore reads/writes.
- Add Google Sheets sync and scheduled reminder cloud functions.
- Expand the app into multi-branch SaaS operations.
