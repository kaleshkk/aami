from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base, get_db
from app.main import app


SQLALCHEMY_TEST_URL = "sqlite+pysqlite:///:memory:"

engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
  db = TestingSessionLocal()
  try:
    yield db
  finally:
    db.close()


app.dependency_overrides[get_db] = override_get_db

Base.metadata.create_all(bind=engine)

client = TestClient(app)


def register_user(email: str = "test@example.com", password: str = "secret123") -> str:
  resp = client.post(
    "/api/auth/register",
    json={"email": email, "password": password, "master_salt": None},
  )
  assert resp.status_code == 201
  data = resp.json()
  return data["access_token"]


def auth_header(token: str) -> dict[str, str]:
  return {"Authorization": f"Bearer {token}"}


def test_register_and_login():
  token = register_user()
  assert token

  resp = client.post(
    "/api/auth/login",
    data={"username": "test@example.com", "password": "secret123"},
    headers={"Content-Type": "application/x-www-form-urlencoded"},
  )
  assert resp.status_code == 200
  assert "access_token" in resp.json()


def test_create_and_get_item_roundtrip():
  token = register_user("vault@example.com")

  create_resp = client.post(
    "/api/items/",
    json={
      "encrypted_blob": "ciphertext",
      "iv": "iv-bytes",
      "salt": "salt-bytes",
      "title_hmac": "title-hmac",
      "tags": ["test"],
      "version": 1,
    },
    headers=auth_header(token),
  )
  assert create_resp.status_code == 201
  item_id = create_resp.json()["id"]

  list_resp = client.get("/api/items/", headers=auth_header(token))
  assert list_resp.status_code == 200
  assert len(list_resp.json()) == 1

  get_resp = client.get(f"/api/items/{item_id}", headers=auth_header(token))
  assert get_resp.status_code == 200
  body = get_resp.json()
  assert body["encrypted_blob"] == "ciphertext"
  assert body["iv"] == "iv-bytes"
  assert body["salt"] == "salt-bytes"


def test_ot_link_lifecycle():
  token = register_user("ot@example.com")
  now = datetime.now(timezone.utc)
  expiry = now + timedelta(minutes=5)

  create_resp = client.post(
    "/api/ot-links/",
    json={
      "encrypted_payload": "payload",
      "salt": "salt",
      "iv": "iv",
      "expiry": expiry.isoformat(),
      "single_use": True,
    },
    headers=auth_header(token),
  )
  assert create_resp.status_code == 201
  link_id = create_resp.json()["id"]

  get_resp = client.get(f"/api/ot-links/{link_id}")
  assert get_resp.status_code == 200

  delete_resp = client.delete(f"/api/ot-links/{link_id}", headers=auth_header(token))
  assert delete_resp.status_code == 204


