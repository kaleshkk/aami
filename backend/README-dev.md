## Backend local development

1. Create and activate a Python 3.11 environment.
2. Install dependencies with Poetry:

```bash
cd backend
pip install --upgrade pip
pip install poetry
poetry install
```

3. Set environment variables (example values match `docker-compose.yml`):

```bash
export DATABASE_URL=postgresql://vault:changeme@localhost:5432/vaultdb
export SECRET_KEY="changeme_should_be_random"
```

4. Run database migrations:

```bash
alembic upgrade head
```

5. Start the API:

```bash
uvicorn app.main:app --reload
```


