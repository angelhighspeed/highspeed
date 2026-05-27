from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.plan_model import Plan
from app.schemas.plan_schema import PlanCreate, PlanResponse
from app.auth.dependencies import require_roles

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/plans", response_model=list[PlanResponse])
def get_plans(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin", "tecnico", "operador", "cobrador"])
    ),
):
    return db.query(Plan).all()


@router.post("/plans", response_model=PlanResponse)
def create_plan(
    plan: PlanCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    new_plan = Plan(**plan.model_dump())

    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)

    return new_plan


@router.put("/plans/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: int,
    plan: PlanCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    plan_item = db.query(Plan).filter(Plan.id == plan_id).first()

    if not plan_item:
        return {"error": "Plan no encontrado"}

    data = plan.model_dump()

    for key, value in data.items():
        setattr(plan_item, key, value)

    db.commit()
    db.refresh(plan_item)

    return plan_item


@router.delete("/plans/{plan_id}")
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    plan_item = db.query(Plan).filter(Plan.id == plan_id).first()

    if not plan_item:
        return {"error": "Plan no encontrado"}

    db.delete(plan_item)
    db.commit()

    return {"message": "Plan eliminado"}


@router.get("/plans/{plan_id}/mikrotik-rules")
def export_plan_mikrotik_rules(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico"])),
):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()

    if not plan:
        return {"error": "Plan no encontrado"}

    profile = plan.profile or plan.name
    rate_limit = f"{plan.upload_speed or plan.speed}/{plan.download_speed or plan.speed}"

    script = f"""
/ppp profile add name="{profile}" rate-limit="{rate_limit}" only-one=yes
"""

    return {
        "plan_id": plan.id,
        "plan": plan.name,
        "profile": profile,
        "rate_limit": rate_limit,
        "script": script.strip(),
    }