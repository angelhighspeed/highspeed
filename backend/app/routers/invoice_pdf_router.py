from io import BytesIO
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
)
from reportlab.lib.units import cm

from app.database import SessionLocal
from app.auth.dependencies import require_roles
from app.models.invoice_model import Invoice
from app.models.customer_model import Customer


router = APIRouter()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def format_date(value):
    if value is None:
        return ""

    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    return str(value)


def format_status(status):
    if status == "paid":
        return "Pagada"

    if status == "pending":
        return "Pendiente"

    return status or ""


def money(value):
    try:
        return f"${float(value or 0):,.2f}"
    except Exception:
        return "$0.00"


@router.get("/invoices/export-pdf")
def export_invoices_pdf(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    query = db.query(Invoice)

    if status:
        query = query.filter(Invoice.status == status)

    invoices = query.order_by(Invoice.id.desc()).all()

    customer_ids = list({
        invoice.customer_id
        for invoice in invoices
        if invoice.customer_id
    })

    customers = (
        db.query(Customer)
        .filter(Customer.id.in_(customer_ids))
        .all()
        if customer_ids
        else []
    )

    customers_by_id = {
        customer.id: customer
        for customer in customers
    }

    output = BytesIO()

    doc = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        rightMargin=1 * cm,
        leftMargin=1 * cm,
        topMargin=1 * cm,
        bottomMargin=1 * cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    if status == "pending":
        title = "Facturas pendientes"
        filename = "facturas_pendientes.pdf"
    elif status == "paid":
        title = "Facturas pagadas"
        filename = "facturas_pagadas.pdf"
    else:
        title = "Todas las facturas"
        filename = "facturas.pdf"

    elements.append(Paragraph(f"<b>HighSpeed ISP CRM - {title}</b>", styles["Title"]))
    elements.append(Spacer(1, 0.3 * cm))

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    elements.append(Paragraph(f"Generado: {generated_at}", styles["Normal"]))
    elements.append(Spacer(1, 0.4 * cm))

    total_amount = sum(float(invoice.amount or 0) for invoice in invoices)

    elements.append(
        Paragraph(
            f"Total facturas: {len(invoices)} | Total monto: {money(total_amount)}",
            styles["Normal"],
        )
    )

    elements.append(Spacer(1, 0.4 * cm))

    data = [
        [
            "ID",
            "Cliente",
            "Usuario",
            "IP",
            "Telefono",
            "Zona",
            "Monto",
            "Vence",
            "Estado",
        ]
    ]

    for invoice in invoices:
        customer = customers_by_id.get(invoice.customer_id)

        if customer:
            customer_name = f"{customer.name or ''} {customer.last_name or ''}".strip()
            username = customer.pppoe_username or "-"
            ip = customer.remote_address or "-"
            phone = customer.phone or "-"
            zone = customer.zone or "-"
        else:
            customer_name = f"Cliente ID {invoice.customer_id}"
            username = "-"
            ip = "-"
            phone = "-"
            zone = "-"

        data.append([
            str(invoice.id),
            customer_name or "-",
            username,
            ip,
            phone,
            zone,
            money(invoice.amount),
            format_date(invoice.due_date),
            format_status(invoice.status),
        ])

    table = Table(
        data,
        repeatRows=1,
        colWidths=[
            1.2 * cm,
            5.2 * cm,
            3.2 * cm,
            3.0 * cm,
            3.0 * cm,
            3.0 * cm,
            2.4 * cm,
            2.4 * cm,
            2.4 * cm,
        ],
    )

    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),

            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 7),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),

            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),

            ("ALIGN", (0, 1), (0, -1), "CENTER"),
            ("ALIGN", (6, 1), (8, -1), "CENTER"),
        ])
    )

    elements.append(table)

    doc.build(elements)

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )