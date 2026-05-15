from io import BytesIO
from datetime import date, datetime
from pathlib import Path
import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
)
from reportlab.lib.units import cm
from reportlab.pdfgen.canvas import Canvas

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
    current_file = Path(__file__).resolve()
    app_dir = current_file.parents[1]
    backend_dir = current_file.parents[2]

    possible_paths = [
        app_dir / "static" / "logo.png",
        backend_dir / "app" / "static" / "logo.png",
        backend_dir / "static" / "logo.png",
        backend_dir.parent / "frontend" / "src" / "assets" / "logo.png",
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
        return "-"

    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")

    return str(value)


def format_datetime(value):
    if value is None:
        return datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M:%S")

    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")

    return str(value)


def money(value):
    try:
        return f"${float(value or 0):,.2f}"
    except Exception:
        return "$0.00"


def format_status(status):
    if status == "paid":
        return "PAGADO"

    if status == "pending":
        return "PENDIENTE"

    return str(status or "-").upper()


def safe_filename(value):
    if not value:
        return "cliente"

    value = str(value).strip().lower()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = value.strip("_")

    return value or "cliente"


def get_payment_date(invoice):
    for field in ["paid_at", "payment_date", "paid_date", "updated_at"]:
        value = getattr(invoice, field, None)

        if value:
            return value

    return datetime.now()


def draw_receipt_background(canvas: Canvas, doc):
    page_width, page_height = A4

    canvas.saveState()

    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, page_width, page_height, fill=1, stroke=0)

    canvas.setFillColor(colors.HexColor("#2563EB"))
    path = canvas.beginPath()
    path.moveTo(page_width - 4.5 * cm, page_height)
    path.lineTo(page_width, page_height)
    path.lineTo(page_width, page_height - 6 * cm)
    path.curveTo(
        page_width - 1.5 * cm,
        page_height - 4.5 * cm,
        page_width - 3.5 * cm,
        page_height - 2.3 * cm,
        page_width - 4.5 * cm,
        page_height,
    )
    canvas.drawPath(path, fill=1, stroke=0)

    canvas.setFillColor(colors.HexColor("#DBEAFE"))
    path = canvas.beginPath()
    path.moveTo(page_width - 6.3 * cm, page_height)
    path.lineTo(page_width - 3.6 * cm, page_height)
    path.curveTo(
        page_width - 4.3 * cm,
        page_height - 1.2 * cm,
        page_width - 5.2 * cm,
        page_height - 2.1 * cm,
        page_width - 6.1 * cm,
        page_height - 3.2 * cm,
    )
    path.curveTo(
        page_width - 6.7 * cm,
        page_height - 2 * cm,
        page_width - 6.9 * cm,
        page_height - 0.8 * cm,
        page_width - 6.3 * cm,
        page_height,
    )
    canvas.drawPath(path, fill=1, stroke=0)

    canvas.setFillColor(colors.HexColor("#F97316"))
    path = canvas.beginPath()
    path.moveTo(page_width - 3.2 * cm, 0)
    path.lineTo(page_width, 0)
    path.lineTo(page_width, 2.8 * cm)
    path.curveTo(
        page_width - 1.1 * cm,
        2.1 * cm,
        page_width - 2.2 * cm,
        1.3 * cm,
        page_width - 3.2 * cm,
        0,
    )
    canvas.drawPath(path, fill=1, stroke=0)

    canvas.setStrokeColor(colors.HexColor("#2563EB"))
    canvas.setLineWidth(1.2)
    canvas.line(1.2 * cm, 1.35 * cm, page_width - 1.2 * cm, 1.35 * cm)

    canvas.restoreState()


def make_label_value_table(rows, header_bg="#EFF6FF"):
    table = Table(
        rows,
        colWidths=[
            4.5 * cm,
            12.5 * cm,
        ],
    )

    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(header_bg)),
            ("BACKGROUND", (1, 0), (1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )

    return table


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

    customer_name = f"Cliente ID {invoice.customer_id}"

    if customer:
        customer_name = f"{customer.name or ''} {customer.last_name or ''}".strip()

    output = BytesIO()

    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=1.4 * cm,
        leftMargin=1.4 * cm,
        topMargin=1 * cm,
        bottomMargin=1 * cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReceiptTitle",
        parent=styles["Title"],
        fontSize=26,
        textColor=colors.HexColor("#0F172A"),
        alignment=1,
        spaceAfter=4,
    )

    section_title_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading3"],
        fontSize=13,
        textColor=colors.HexColor("#1D4ED8"),
        spaceAfter=8,
    )

    center_small_style = ParagraphStyle(
        "CenterSmall",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor("#475569"),
    )

    elements = []

    logo_path = find_logo_path()

    if logo_path:
        try:
            logo = Image(logo_path)
            logo.drawHeight = 2.1 * cm
            logo.drawWidth = 6.2 * cm

            logo_table = Table(
                [[logo]],
                colWidths=[17 * cm],
            )

            logo_table.setStyle(
                TableStyle([
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ])
            )

            elements.append(logo_table)
        except Exception:
            elements.append(Paragraph(f"<b>{COMPANY_DATA['brand']}</b>", title_style))
    else:
        elements.append(Paragraph(f"<b>{COMPANY_DATA['brand']}</b>", title_style))

    elements.append(Paragraph("<b>RECIBO DE PAGO</b>", title_style))
    elements.append(Spacer(1, 0.12 * cm))

    status_text = format_status(invoice.status)

    if invoice.status == "paid":
        status_label = "Factura pagada"
        status_bg = "#DCFCE7"
        status_text_color = "#15803D"
        status_border = "#BBF7D0"
    else:
        status_label = "Factura pendiente"
        status_bg = "#FFEDD5"
        status_text_color = "#EA580C"
        status_border = "#FED7AA"

    status_table = Table(
        [[status_label]],
        colWidths=[7 * cm],
    )

    status_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(status_bg)),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor(status_text_color)),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 14),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor(status_border)),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ])
    )

    status_wrapper = Table([[status_table]], colWidths=[17 * cm])
    status_wrapper.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ])
    )
    elements.append(status_wrapper)

    elements.append(Paragraph("<b>DATOS DE LA EMPRESA</b>", section_title_style))

    company_rows = [
        ["Nombre", COMPANY_DATA["business_name"]],
        ["CUIT", COMPANY_DATA["cuit"]],
        ["Localidad", COMPANY_DATA["locality"]],
        ["Telefono", COMPANY_DATA["phone"]],
        ["Direccion", COMPANY_DATA["address"]],
    ]

    company_table = make_label_value_table(company_rows, header_bg="#EFF6FF")
    elements.append(company_table)
    elements.append(Spacer(1, 0.45 * cm))

    elements.append(Paragraph("<b>DETALLES DEL RECIBO</b>", section_title_style))

    payment_date = get_payment_date(invoice)

    receipt_rows = [
        ["Cliente", customer_name or "-"],
        ["Factura Nro.", str(invoice.id)],
        ["Recibo Nro.", f"REC-{invoice.id}"],
        ["Fecha de pago", format_datetime(payment_date)],
        ["Metodo de pago", getattr(invoice, "payment_method", None) or "Efectivo"],
        ["Observacion", getattr(invoice, "payment_note", None) or "-"],
        ["Usuario PPPoE", customer.pppoe_username if customer else "-"],
        ["IP Cliente", customer.remote_address if customer else "-"],
        ["Telefono Cliente", customer.phone if customer else "-"],
        ["Zona", customer.zone if customer else "-"],
        ["Concepto", "Servicio de Internet"],
        ["Vencimiento", format_date(invoice.due_date)],
        ["Importe abonado", money(invoice.amount)],
        ["Estado", status_text],
    ]

    receipt_table = make_label_value_table(receipt_rows, header_bg="#DBEAFE")
    elements.append(receipt_table)
    elements.append(Spacer(1, 0.4 * cm))

    if invoice.status != "paid":
        warning_table = Table(
            [["ATENCION: Esta factura todavia no figura como pagada."]],
            colWidths=[17 * cm],
        )

        warning_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#DC2626")),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#FCA5A5")),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ])
        )

        elements.append(warning_table)
        elements.append(Spacer(1, 0.35 * cm))

    certification_table = Table(
        [
            [
                "Este recibo certifica que la factura fue abonada correctamente."
                if invoice.status == "paid"
                else "Este documento fue generado como comprobante de factura."
            ]
        ],
        colWidths=[17 * cm],
    )

    certification_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4" if invoice.status == "paid" else "#FFF7ED")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#166534" if invoice.status == "paid" else "#9A3412")),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#BBF7D0" if invoice.status == "paid" else "#FED7AA")),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ])
    )

    elements.append(certification_table)
    elements.append(Spacer(1, 0.65 * cm))

    signature_table = Table(
        [
            ["______________________________"],
            [COMPANY_DATA["business_name"]],
            ["Titular"],
        ],
        colWidths=[17 * cm],
    )

    signature_table.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 1), (0, 1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
        ])
    )

    elements.append(signature_table)
    elements.append(Spacer(1, 0.35 * cm))

    elements.append(
        Paragraph(
            f"{COMPANY_DATA['brand']} CRM - Comprobante generado automaticamente.",
            center_small_style,
        )
    )

    doc.build(
        elements,
        onFirstPage=draw_receipt_background,
        onLaterPages=draw_receipt_background,
    )

    output.seek(0)

    customer_filename = safe_filename(customer_name)
    filename = f"recibo_{customer_filename}_factura_{invoice.id}.pdf"

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
