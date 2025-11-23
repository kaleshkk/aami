## aami – Zero‑Knowledge Password Vault

aami is a **FastAPI + React** implementation of a **zero‑knowledge password and secret manager**.  
All secrets are **encrypted in the browser** using a master passphrase before they are sent to the backend.  
The backend only stores encrypted data and metadata – it never sees or stores your plaintext secrets.

---

### Overview

- **Zero‑knowledge design**: The server never learns your master passphrase or your decrypted secrets.
- **Client‑side encryption**: All sensitive values are encrypted in the browser using modern web crypto APIs.
- **Secure search**: Optional search over item titles using HMAC, without exposing the actual titles.
- **One‑time links**: Share secrets via expiring, single‑use links that are also encrypted client‑side.
- **JWT‑based auth**: Short‑lived access tokens protect the API; passwords are securely hashed.

---

### Tech Stack

- **Backend**: FastAPI, SQLAlchemy, Alembic, JWT auth (`backend/`)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Query (`frontend/`)
- **Database**: PostgreSQL (see `docker-compose.yml`)

---

### How Security & Encryption Work

#### 1. Master passphrase and key derivation (browser only)

- The user chooses a **master passphrase**.
- The frontend generates a random **master salt** and sends only the salt to the backend for storage.
- In the browser, a **master key** is derived from:
  - passphrase + master salt, using **PBKDF2‑SHA256** with a high iteration count.
- This master key **never leaves the browser** and is kept only in memory during the session.

#### 2. Key hierarchy and per‑item encryption

From the master key, the app derives separate keys using **HKDF (SHA‑256)** with different labels:

- **Encryption root key** → used to derive **per‑item AES‑GCM keys**.
- **Search key** → used to compute **HMACs of titles** for secure searching.

For each secret item:

- A random **item salt** and **IV** (initialization vector) are generated.
- A **per‑item AES‑GCM key** is derived from the encryption root + item salt.
- The plaintext secret is encrypted with **AES‑GCM**.
- The backend stores only:
  - `encrypted_blob` (ciphertext)
  - `iv`
  - `salt`
  - optional `title_hmac` (for search)
- The database **never contains the plaintext secret or title**.

#### 3. Secure search

- To enable searching by title, the frontend computes:
  - `HMAC(title, searchKey)` where `searchKey` is derived from the master key.
- The backend stores only this **HMAC value** and can index it for search.
- The server cannot recover the original title from the HMAC.

#### 4. One‑time (OT) links

- For one‑time share links:
  - The frontend derives an **ephemeral AES‑GCM key** from a short passphrase + random salt using PBKDF2.
  - The payload is encrypted client‑side with **AES‑GCM** and a random IV.
  - The backend stores only:
    - `encrypted_payload`, `salt`, `iv`, plus expiry and usage flags.
- The backend validates **expiry and usage**, but **never sees the decrypted payload**.

#### 5. Authentication and account security (backend)

- **User passwords** (for login) are hashed with **PBKDF2‑SHA256** (via Passlib).
  - The backend stores only `password_hash`, not the raw password.
- On successful login/registration:
  - The backend issues a **JWT access token** signed with **HS256**.
  - The token contains the user ID (`sub`) and an expiry time.
- Each authenticated request includes the JWT; the backend:
  - Verifies the signature and expiry.
  - Loads the user from the database.
- Logout is **stateless**:
  - The frontend discards the JWT.
  - The in‑memory master key is cleared, effectively locking the vault.

---

### Running with Docker

From the project root:

docker-compose build
docker-compose upServices:

- **API**: `http://localhost:8000`
- **Frontend**: `http://localhost:3000`

---

### Local Backend Development (without Docker)

cd backend
# create & activate your virtualenv, then:
poetry install  # or pip install -r requirements.txt equivalent
# set environment variables (e.g. SECRET_KEY, DATABASE_URL) or use .env
alembic upgrade head
uvicorn app.main:app --reloadSee `backend/README-dev.md` for more detailed backend setup and migration commands.

---

### Tests

- **Backend unit tests**:

cd backend
pytest- **Frontend crypto tests**:

cd frontend
npm install
npm test- **End‑to‑end (E2E) smoke test** (requires the app running on `localhost:3000`):

cd frontend
npx playwright install
npm run test:e2e---

### Folder Structure (high level)

- **`backend/`**: FastAPI app, models, schemas, API routes, config, and tests.
- **`frontend/`**: React SPA, crypto utilities, pages (login, vault, settings, OT view), and tests.
- **`docker-compose.yml`**: Orchestration for API, frontend, and PostgreSQL.
- **`README.md`**: Project description and security model (this file).

---

### Deployment & Hardening Notes

- Set strong, unique values in environment variables:
  - **JWT `SECRET_KEY`**
  - **Postgres credentials and `DATABASE_URL`**
- Terminate TLS with a hardened reverse proxy (nginx/Traefik) and enforce HTTPS.
- Consider:
  - Rate limiting on auth and OT‑link endpoints.
  - Security headers (CSP, X‑Frame‑Options, etc.).
  - Regular dependency audits (`pip-audit`, `npm audit`) and base image updates.

---

### Short Security Summary

> aami is a zero‑knowledge password vault. Your master passphrase never leaves your browser. All secrets are encrypted client‑side with per‑item AES‑GCM keys derived from your master key. The backend stores only encrypted blobs, HMACs for search, and hashed login passwords, protected by short‑lived JWT tokens.