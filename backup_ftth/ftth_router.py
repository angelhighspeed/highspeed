import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.auth.dependencies import require_roles

router = APIRouter()

class FTTHNetworkPayload(BaseModel):
    nodes: list = []
    boxes: list = []
    cables: list = []
    accessories: list = []
    splices: list = []
    otdr_events: list = []

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def ensure_ftth_table():
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ftth_network (
                    key VARCHAR PRIMARY KEY,
                    value TEXT
                )
            """))
        else:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ftth_network (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """))

ensure_ftth_table()

def read_value(db: Session, key: str):
    row = db.execute(text("SELECT value FROM ftth_network WHERE key = :key"), {"key": key}).mappings().first()
    if not row:
        return []
    try:
        return json.loads(row["value"] or "[]")
    except Exception:
        return []

def write_value(db: Session, key: str, value):
    serialized = json.dumps(value, ensure_ascii=False)
    if engine.dialect.name == "postgresql":
        db.execute(text("""
            INSERT INTO ftth_network (key, value)
            VALUES (:key, :value)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """), {"key": key, "value": serialized})
    else:
        db.execute(text("""
            INSERT OR REPLACE INTO ftth_network (key, value)
            VALUES (:key, :value)
        """), {"key": key, "value": serialized})

@router.get("/ftth-network")
def get_ftth_network(db: Session = Depends(get_db), current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"]))):
    ensure_ftth_table()
    nodes = read_value(db, "nodes")
    boxes = read_value(db, "boxes")
    if not nodes and boxes:
        nodes = boxes
    return {
        "status": "ok",
        "nodes": nodes,
        "boxes": nodes,
        "cables": read_value(db, "cables"),
        "accessories": read_value(db, "accessories"),
        "splices": read_value(db, "splices"),
        "otdr_events": read_value(db, "otdr_events"),
    }

@router.put("/ftth-network")
def save_ftth_network(data: FTTHNetworkPayload, db: Session = Depends(get_db), current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"]))):
    ensure_ftth_table()
    nodes = data.nodes or data.boxes
    write_value(db, "nodes", nodes)
    write_value(db, "boxes", nodes)
    write_value(db, "cables", data.cables)
    write_value(db, "accessories", data.accessories)
    write_value(db, "splices", data.splices)
    write_value(db, "otdr_events", data.otdr_events)
    db.commit()
    return {"status": "ok", "message": "Mapa FTTH guardado correctamente.", "nodes": nodes, "boxes": nodes, "cables": data.cables, "accessories": data.accessories, "splices": data.splices, "otdr_events": data.otdr_events}
