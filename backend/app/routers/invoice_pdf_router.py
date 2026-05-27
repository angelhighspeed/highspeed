from io import BytesIO
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    Image,
)
from reportlab.lib.units import cm

from app.database import SessionLocal
from app.auth.dependencies import require_roles
from app.models.invoice_model import Invoice
from app.models.customer_model import Customer


router = APIRouter()


COMPANY_DATA = {
    "brand": "HighSpeed ISP",
    "business_name": "Angel Gabriel Benitez",
    "cuit": "20-38265225-9",
    "locality": "Ituzaingo, Corrientes",
    "phone": "3786494305",
    "address": "Santa Fe entre calle 11 y 12",
}


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def find_logo_path():
    possible_paths = [
        Path("app/static/logo.png"),
        Path("static/logo.png"),
        Path("../frontend/src/assets/logo.png"),
        Path("frontend/src/assets/logo.png"),
    ]

    for path in possible_paths:
        if path.exists():
            return str(path)

    return None


def format_date(value):
    if value is None:
        return ""

    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")

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
        topMargin=0.8 * cm,
        bottomMargin=0.8 * cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=20,
        textColor=colors.HexColor("#0F172A"),
        alignment=1,
        spaceAfter=8,
    )

    normal_center = ParagraphStyle(
        "NormalCenter",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#334155"),
        alignment=1,
    )

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

    logo_path = find_logo_path()

    if logo_path:
        try:
            logo = Image(logo_path)
            logo.drawHeight = 1.8 * cm
            logo.drawWidth = 5.5 * cm

            logo_table = Table(
                [[logo]],
                colWidths=[27 * cm],
            )

            logo_table.setStyle(
                TableStyle([
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ])
            )

            elements.append(logo_table)

        except Exception:
            elements.append(
                Paragraph(f"<b>{COMPANY_DATA['brand']}</b>", title_style)
            )
    else:
        elements.append(
            Paragraph(f"<b>{COMPANY_DATA['brand']}</b>", title_style)
        )

    elements.append(
        Paragraph(
            f"<b>{COMPANY_DATA['brand']} CRM - {title}</b>",
            title_style,
        )
    )

    company_info = (
        f"{COMPANY_DATA['business_name']} | "
        f"CUIT: {COMPANY_DATA['cuit']} | "
        f"{COMPANY_DATA['locality']} | "
        f"Tel: {COMPANY_DATA['phone']} | "
        f"{COMPANY_DATA['address']}"
    )

    elements.append(Paragraph(company_info, normal_center))
    elements.append(Spacer(1, 0.3 * cm))

    generated_at = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    total_amount = sum(float(invoice.amount or 0) for invoice in invoices)

    summary_table = Table(
        [[
            f"Generado: {generated_at}",
            f"Total facturas: {len(invoices)}",
            f"Total monto: {money(total_amount)}",
        ]],
        colWidths=[
            9 * cm,
            9 * cm,
            9 * cm,
        ],
    )

    summary_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1E3A8A")),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#BFDBFE")),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])
    )

    elements.append(summary_table)
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
            (
                "ROWBACKGROUNDS",
                (0, 1),
                (-1, -1),
                [
                    colors.white,
                    colors.HexColor("#F8FAFC"),
                ],
            ),

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