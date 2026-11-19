# ElderCare Connect

A beginner-friendly full-stack demo for coordinating home-care requests, caregivers, appointments and patient vital records. Built as a portfolio prototype inspired by common home-healthcare workflows; it is not affiliated with YORO Health and is not a clinical product.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (`pg`)
- Demo authentication: JWT + bcrypt

## Run locally
### 1. Database
Create a PostgreSQL database named `eldercare_connect`, then run:
```bash
psql -d eldercare_connect -f backend/schema.sql
```
### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
### 3. Frontend
In another terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL printed in the terminal. Set `VITE_API_URL=http://localhost:5000` in `frontend/.env` if needed.

## Demo account
Register a new account through the UI. The first account is created with the `FAMILY` role. New registrations receive the `FAMILY` role. To prepare a local demo caregiver or administrator, register an account first, then update its role directly in PostgreSQL (for example: `UPDATE users SET role='CAREGIVER' WHERE email='caregiver@example.com';`). Public self-registration deliberately does not accept a role field. Production role management must be restricted to authorized administrators.

## Implemented MVP
- Register and log in with JWT
- Role-aware API foundation
- Create and view care requests
- Assign caregiver to a request (admin endpoint)
- Record and view patient vitals
- Dashboard summary and demo UI

## Important limitations
This is a portfolio MVP, not production-ready healthcare software. It uses synthetic data only. Before any real deployment, add robust authorization and audit logging, secure secret management, rate limiting, input validation, tests, backups, encryption policies, consent flows and applicable healthcare/privacy compliance review. Do not enter real patient data.
