## aami – Password Vault

FastAPI + React implementation of a zero-knowledge password/secret manager. All secret values are encrypted **client-side** using a master passphrase; the backend only ever stores encrypted blobs and metadata.

### Stack

- Backend: `backend/` – FastAPI, SQLAlchemy, Alembic, JWT auth.
- Frontend: `frontend/` – React + TypeScript + Vite + Tailwind, React Query.
- DB: Postgres (see `docker-compose.yml`).

### Running with Docker

```bash
docker-compose build
docker-compose up
```

Services:

- API: `http://localhost:8000`
- Frontend: `http://localhost:3000`

### Local backend dev (without Docker)

See `backend/README-dev.md` for Poetry-based setup, env vars, and migration commands.

### Tests

- Backend unit tests:

```bash
cd backend
pytest
```

- Frontend crypto tests:

```bash
cd frontend
npm install   # or yarn / pnpm
npm test
```

- E2E smoke test (requires `docker-compose` up so the app is reachable on `localhost:3000`):

```bash
cd frontend
npx playwright install
npm run test:e2e
```

### Security & hardening notes

- **Zero-knowledge**:
  - Master passphrase is never sent to the backend.
  - Master key is derived in-browser via Argon2id and kept in memory only.
  - Per-item keys derived via HKDF, encrypted with AES-GCM; only ciphertext + IV + salt are stored.
- **Search**:
  - Optional title search via HMAC of the title using a key derived from the master key; server only sees the HMAC.
- **One-time links**:
  - OT payload is encrypted client-side with an ephemeral key (PBKDF2 + AES-GCM) and stored as an opaque blob; the server validates expiry and usage but never sees plaintext.
- **Sessions**:
  - Short-lived JWT access tokens; session provider keeps the master key in memory and auto-locks on inactivity.
- **Deployment hardening recommendations**:
  - Use strong, unique `SECRET_KEY` and Postgres credentials (ideally via a secrets manager).
  - Terminate TLS with a hardened reverse proxy (nginx/Traefik) and enforce HTTPS.
  - Set strict cookies (`Secure`, `HttpOnly`, `SameSite=Strict`) if switching to cookie-based auth.
  - Tune Argon2id parameters per environment and document them (time/memory cost).
  - Add rate-limiting and IP-based throttling on auth and OT-link endpoints.
  - Enable CSP, X-Frame-Options, and other security headers at the edge.
  - Regularly run dependency audits (e.g., `pip-audit`, `npm audit`) and keep base images up to date.


