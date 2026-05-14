from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.installation_model import Installation
from app.schemas.installation_schema import InstallationCreate, InstallationResponse
from app.auth.dependencies import require_roles

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/installations", response_model=list[InstallationResponse])
def get_installations(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"]))
):
    return db.query(Installation).all()


@router.post("/installations", response_model=InstallationResponse)
def create_installation(
    installation: InstallationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico"]))
):
    new_installation = Installation(
        customer_id=installation.customer_id,
        technician=installation.technician,
        scheduled_date=installation.scheduled_date,
        address=installation.address,
        installation_type=installation.installation_type,
        notes=installation.notes,
        status="pending"
    )

    db.add(new_installation)
    db.commit()
    db.refresh(new_installation)

    return new_installation


@router.put("/installations/{installation_id}/complete", response_model=InstallationResponse)
def complete_installation(
    installation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico"]))
):
    installation = db.query(Installation).filter(Installation.id == installation_id).first()

    if not installation:
        return {"error": "Instalación no encontrada"}

    installation.status = "completed"

    db.commit()
    db.refresh(installation)

    return installation


@router.put("/installations/{installation_id}/cancel", response_model=InstallationResponse)
def cancel_installation(
    installation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico"]))
):
    installation = db.query(Installation).filter(Installation.id == installation_id).first()

    if not installation:
        return {"error": "Instalación no encontrada"}

    installation.status = "cancelled"

    db.commit()
    db.refresh(installation)

    return installation