from io import BytesIO
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
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
        return "-"

    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    return str(value)


def money(value):
    try:
        return f"${float(value or 0):,.2f}"
    except Exception:
        return "$0.00"


def format_status(status):
    if status == "paid":
        return "Pagada"

    if status == "pending":
        return "Pendiente"

    return status or "-"


@router.get("/invoices/{invoice_id}/receipt-pdf")
def export_invoice_receipt_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Factura no encontrada",
        )

    customer = (
        db.query(Customer)
        .filter(Customer.id == invoice.customer_id)
        .first()
    )

    output = BytesIO()

    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    customer_name = f"Cliente ID {invoice.customer_id}"

    if customer:
        customer_name = f"{customer.name or ''} {customer.last_name or ''}".strip()

    elements.append(
        Paragraph(
            "<b>HighSpeed ISP</b>",
            styles["Title"],
        )
    )

    elements.append(
        Paragraph(
            "<b>Comprobante de pago</b>",
            styles["Heading2"],
        )
    )

    elements.append(Spacer(1, 0.4 * cm))

    status_text = format_status(invoice.status)

    if invoice.status != "paid":
        elements.append(
            Paragraph(
                "<font color='red'><b>ATENCIÓN: Esta factura todavía no figura como pagada.</b></font>",
                styles["Normal"],
            )
        )

        elements.append(Spacer(1, 0.4 * cm))

    data = [
        ["Comprobante", f"REC-{invoice.id}"],
        ["Factura ID", str(invoice.id)],
        ["Fecha emisión", generated_at],
        ["Cliente", customer_name or "-"],
        ["Usuario PPPoE", customer.pppoe_username if customer else "-"],
        ["IP Cliente", customer.remote_address if customer else "-"],
        ["Teléfono", customer.phone if customer else "-"],
        ["Zona", customer.zone if customer else "-"],
        ["Vencimiento", format_date(invoice.due_date)],
        ["Estado", status_text],
        ["Monto abonado", money(invoice.amount)],
    ]

    table = Table(
        data,
        colWidths=[
            5 * cm,
            10 * cm,
        ],
    )

    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#E2E8F0")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])
    )

    elements.append(table)

    elements.append(Spacer(1, 1 * cm))

    elements.append(
        Paragraph(
            "Este comprobante fue generado automáticamente por HighSpeed ISP CRM.",
            styles["Normal"],
        )
    )

    elements.append(Spacer(1, 0.3 * cm))

    elements.append(
        Paragraph(
            "Gracias por su pago.",
            styles["Heading3"],
        )
    )

    doc.build(elements)

    output.seek(0)

    filename = f"recibo_factura_{invoice.id}.pdf"

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )