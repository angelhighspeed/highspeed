from io import BytesIO
from datetime import datetime, date
from pathlib import Path
import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
)
from reportlab.pdfgen.canvas import Canvas

from app.database import SessionLocal, engine
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
    "email": "",
}


class PaymentPromiseRequest(BaseModel):
    promise_date: str
    note: str = ""


def now_string():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_table_columns(table_name: str):
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if dialect == "sqlite":
            rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            return [row[1] for row in rows]

        rows = conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = :table_name
                """
            ),
            {"table_name": table_name},
        ).fetchall()

        return [row[0] for row in rows]


def ensure_invoice_promise_columns():
    dialect = engine.dialect.name

    try:
        if dialect == "postgresql":
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_promise_date VARCHAR"))
                conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_promise_note TEXT"))
                conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_promise_status VARCHAR DEFAULT ''"))
                conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_promise_created_at VARCHAR"))
            return

        if dialect == "sqlite":
            columns = get_table_columns("invoices")

            alters = {
                "payment_promise_date": "ALTER TABLE invoices ADD COLUMN payment_promise_date VARCHAR",
                "payment_promise_note": "ALTER TABLE invoices ADD COLUMN payment_promise_note TEXT",
                "payment_promise_status": "ALTER TABLE invoices ADD COLUMN payment_promise_status VARCHAR DEFAULT ''",
                "payment_promise_created_at": "ALTER TABLE invoices ADD COLUMN payment_promise_created_at VARCHAR",
            }

            with engine.begin() as conn:
                for column, statement in alters.items():
                    if column not in columns:
                        conn.execute(text(statement))

    except Exception as e:
        print("No se pudieron asegurar columnas de promesa de pago:", e)


ensure_invoice_promise_columns()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def ensure_company_settings_table_for_pdf():
    dialect = engine.dialect.name

    try:
        with engine.begin() as conn:
            if dialect == "postgresql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS company_settings (
                            key VARCHAR PRIMARY KEY,
                            value TEXT
                        )
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS company_settings (
                            key TEXT PRIMARY KEY,
                            value TEXT
                        )
                        """
                    )
                )
    except Exception as e:
        print("No se pudo asegurar company_settings:", e)


def get_company_settings_for_pdf(db: Session):
    ensure_company_settings_table_for_pdf()

    settings = COMPANY_DATA.copy()

    try:
        rows = db.execute(
            text("SELECT key, value FROM company_settings")
        ).mappings().all()

        for row in rows:
            key = row["key"]
            value = row["value"]

            if key in settings:
                settings[key] = value or ""
    except Exception as e:
        print("No se pudieron leer datos de empresa:", e)

    return settings


def get_first_attr(obj, names, default=None):
    if obj is None:
        return default

    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)

            if value not in [None, ""]:
                return value

    return default


def clean_filename(value: str):
    value = str(value or "archivo")
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", value)
    value = value.strip("_")

    return value or "archivo"


def format_money(value):
    try:
        number = float(value or 0)
    except Exception:
        number = 0

    return f"$ {number:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_date(value):
    if value in [None, ""]:
        return "-"

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")

    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")

    value_str = str(value)

    # Maneja valores tipo 2026-05-15 o 2026-05-15 19:34:09.
    for fmt in [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
    ]:
        try:
            parsed = datetime.strptime(value_str[:19], fmt)
            if "%H" in fmt:
                return parsed.strftime("%d/%m/%Y %H:%M")
            return parsed.strftime("%d/%m/%Y")
        except Exception:
            pass

    return value_str


def invoice_status_label(status):
    status = str(status or "").lower()

    if status == "paid":
        return "Pagada"

    if status == "cancelled":
        return "Cancelada"

    if status == "overdue":
        return "Vencida"

    return "Pendiente"


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


def receipt_background(canvas: Canvas, doc, company_data=None):
    company_data = company_data or COMPANY_DATA

    page_width, page_height = A4

    canvas.saveState()

    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, page_width, page_height, fill=1, stroke=0)

    canvas.setFillColor(colors.HexColor("#2563EB"))
    canvas.rect(0, page_height - 1.15 * cm, page_width, 1.15 * cm, fill=1, stroke=0)

    canvas.setFillColor(colors.HexColor("#E0F2FE"))
    canvas.circle(page_width - 1.3 * cm, page_height - 1.2 * cm, 1.35 * cm, fill=1, stroke=0)

    canvas.setFillColor(colors.HexColor("#F8FAFC"))
    canvas.rect(0, 0, page_width, 1.15 * cm, fill=1, stroke=0)

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(
        1.4 * cm,
        0.55 * cm,
        f"{company_data.get('brand', COMPANY_DATA['brand'])} - Comprobante generado por sistema",
    )

    canvas.restoreState()


def make_label_value_table(rows, widths=None, header_bg="#F8FAFC"):
    if widths is None:
        widths = [5.2 * cm, 10.5 * cm]

    table = Table(rows, colWidths=widths)

    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(header_bg)),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#334155")),
                ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#0F172A")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    return table


def get_customer_name(customer, invoice):
    if not customer:
        return f"Cliente ID {getattr(invoice, 'customer_id', '-')}"

    name = get_first_attr(customer, ["name", "first_name", "nombre"], "")
    last_name = get_first_attr(customer, ["last_name", "lastname", "apellido"], "")

    full_name = f"{name or ''} {last_name or ''}".strip()

    return full_name or f"Cliente ID {getattr(invoice, 'customer_id', '-')}"


def build_invoice_pdf(invoice: Invoice, customer: Customer | None, company_data=None):
    company_data = company_data or COMPANY_DATA

    output = BytesIO()

    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=1.4 * cm,
        leftMargin=1.4 * cm,
        topMargin=1.45 * cm,
        bottomMargin=1.35 * cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "TitleHighSpeed",
        parent=styles["Title"],
        fontSize=20,
        textColor=colors.HexColor("#0F172A"),
        leading=24,
        spaceAfter=8,
    )

    subtitle_style = ParagraphStyle(
        "SubtitleHighSpeed",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#475569"),
        leading=12,
    )

    section_title_style = ParagraphStyle(
        "SectionTitleHighSpeed",
        parent=styles["Heading3"],
        fontSize=11,
        textColor=colors.HexColor("#1E40AF"),
        leading=14,
        spaceBefore=8,
        spaceAfter=6,
    )

    normal_style = ParagraphStyle(
        "NormalHighSpeed",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#0F172A"),
        leading=12,
    )

    elements = []

    logo_path = find_logo_path()

    header_left = []

    if logo_path:
        try:
            logo = Image(logo_path, width=4.8 * cm, height=1.55 * cm)
            header_left.append(logo)
        except Exception:
            header_left.append(Paragraph(f"<b>{COMPANY_DATA['brand']}</b>", title_style))
    else:
        header_left.append(Paragraph(f"<b>{COMPANY_DATA['brand']}</b>", title_style))

    status = str(getattr(invoice, "status", "") or "").lower()

    document_title = (
        "COMPROBANTE DE PAGO"
        if status == "paid"
        else "FACTURA / COMPROBANTE"
    )

    header_right = [
        Paragraph(f"<b>{document_title}</b>", title_style),
        Paragraph(f"Factura Nro. {invoice.id}", subtitle_style),
        Paragraph(f"Fecha emision: {format_date(get_first_attr(invoice, ['created_at', 'date', 'issued_at'], datetime.now()))}", subtitle_style),
    ]

    header = Table(
        [[header_left, header_right]],
        colWidths=[8.0 * cm, 8.6 * cm],
    )

    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )

    elements.append(header)
    elements.append(Spacer(1, 0.2 * cm))

    company_rows = [
        ["Empresa", company_data.get("business_name", "")],
        ["Marca", company_data.get("brand", "")],
        ["CUIT", company_data.get("cuit", "")],
        ["Localidad", company_data.get("locality", "")],
        ["Direccion", company_data.get("address", "")],
        ["Telefono", company_data.get("phone", "")],
    ]

    if company_data.get("email"):
        company_rows.append(["Email", company_data.get("email", "")])

    elements.append(Paragraph("<b>DATOS DE LA EMPRESA</b>", section_title_style))
    elements.append(make_label_value_table(company_rows, header_bg="#EFF6FF"))

    elements.append(Spacer(1, 0.35 * cm))

    customer_name = get_customer_name(customer, invoice)

    customer_rows = [
        ["Cliente", customer_name],
        ["Cliente ID", str(getattr(invoice, "customer_id", "-"))],
        ["Usuario PPPoE", get_first_attr(customer, ["pppoe_username", "username_pppoe", "username"], "-")],
        ["IP Cliente", get_first_attr(customer, ["remote_address", "ip", "ip_address"], "-")],
        ["Telefono", get_first_attr(customer, ["phone", "telefono", "cellphone", "mobile"], "-")],
        ["Zona", get_first_attr(customer, ["zone", "zona", "localidad"], "-")],
        ["Direccion", get_first_attr(customer, ["address", "direccion"], "-")],
        ["Estado cliente", get_first_attr(customer, ["status", "estado", "state"], "-")],
    ]

    elements.append(Paragraph("<b>DATOS DEL CLIENTE</b>", section_title_style))
    elements.append(make_label_value_table(customer_rows, header_bg="#F0FDF4"))

    elements.append(Spacer(1, 0.35 * cm))

    paid_at = get_first_attr(invoice, ["paid_at", "payment_date", "paid_date"], None)
    due_date = get_first_attr(invoice, ["due_date", "vencimiento"], None)
    invoice_amount = get_first_attr(invoice, ["amount", "total", "monto"], 0)
    payment_method = get_first_attr(invoice, ["payment_method", "method"], "-")
    payment_note = get_first_attr(invoice, ["payment_note", "note", "notes"], "-")

    invoice_rows = [
        ["Factura Nro.", str(invoice.id)],
        ["Comprobante Nro.", f"COMP-{invoice.id}"],
        ["Estado", invoice_status_label(status)],
        ["Monto", format_money(invoice_amount)],
        ["Vencimiento", format_date(due_date)],
        ["Fecha de pago", format_date(paid_at) if paid_at else "-"],
        ["Metodo de pago", payment_method or "-"],
        ["Nota de pago", payment_note or "-"],
    ]

    elements.append(Paragraph("<b>DETALLE DEL COMPROBANTE</b>", section_title_style))
    elements.append(make_label_value_table(invoice_rows, header_bg="#FFF7ED"))

    elements.append(Spacer(1, 0.35 * cm))

    concept_rows = [
        ["Concepto", "Cantidad", "Importe"],
        ["Servicio de internet", "1", format_money(invoice_amount)],
        ["TOTAL", "", format_money(invoice_amount)],
    ]

    concept_table = Table(
        concept_rows,
        colWidths=[9.5 * cm, 3 * cm, 4.1 * cm],
    )

    concept_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D4ED8")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EFF6FF")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    elements.append(Paragraph("<b>CONCEPTO FACTURADO</b>", section_title_style))
    elements.append(concept_table)

    elements.append(Spacer(1, 0.55 * cm))

    note_text = (
        "Este comprobante fue generado automaticamente por el sistema HighSpeed ISP. "
        "Conserve este documento como constancia de la factura seleccionada."
    )

    if status != "paid":
        note_text += " La factura figura como pendiente de pago."

    elements.append(Paragraph(note_text, normal_style))

    doc.build(
        elements,
        onFirstPage=lambda canvas, doc: receipt_background(canvas, doc, company_data),
        onLaterPages=lambda canvas, doc: receipt_background(canvas, doc, company_data),
    )

    output.seek(0)
    return output


def stream_invoice_pdf(invoice: Invoice, customer: Customer | None, company_data=None):
    pdf = build_invoice_pdf(invoice, customer, company_data)

    customer_name = clean_filename(get_customer_name(customer, invoice))
    filename = clean_filename(f"comprobante_factura_{invoice.id}_{customer_name}.pdf")

    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


def get_invoice_and_customer(db: Session, invoice_id: int):
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

    return invoice, customer




def serialize_customer_for_invoice(customer: Customer | None):
    if not customer:
        return {
            "customer_name": "",
            "customer_pppoe_username": "",
            "customer_ip": "",
            "customer_phone": "",
            "customer_zone": "",
            "customer_status": "",
        }

    customer_name = f"{get_first_attr(customer, ['name', 'first_name', 'nombre'], '') or ''} {get_first_attr(customer, ['last_name', 'lastname', 'apellido'], '') or ''}".strip()

    return {
        "customer_name": customer_name,
        "customer_pppoe_username": get_first_attr(customer, ["pppoe_username", "username_pppoe", "username"], ""),
        "customer_ip": get_first_attr(customer, ["remote_address", "ip", "ip_address"], ""),
        "customer_phone": get_first_attr(customer, ["phone", "telefono", "cellphone", "mobile"], ""),
        "customer_zone": get_first_attr(customer, ["zone", "zona", "localidad"], ""),
        "customer_status": get_first_attr(customer, ["status", "estado", "state"], ""),
    }


def normalize_invoice_row(row, customer: Customer | None = None):
    item = dict(row)

    for field in [
        "payment_promise_date",
        "payment_promise_note",
        "payment_promise_status",
        "payment_promise_created_at",
    ]:
        if field not in item:
            item[field] = ""

    item.update(serialize_customer_for_invoice(customer))

    return item


def get_invoice_row_or_404(db: Session, invoice_id: int):
    ensure_invoice_promise_columns()

    rows = db.execute(
        text("SELECT * FROM invoices WHERE id = :id"),
        {"id": invoice_id},
    ).mappings().all()

    if not rows:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    return dict(rows[0])


@router.get("/invoice-promises/invoices")
def get_invoices_with_payment_promises(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "cobrador"])),
):
    ensure_invoice_promise_columns()

    rows = db.execute(
        text("SELECT * FROM invoices ORDER BY id DESC")
    ).mappings().all()

    customer_ids = [
        row.get("customer_id")
        for row in rows
        if row.get("customer_id") is not None
    ]

    customers_by_id = {}

    if customer_ids:
        customers = (
            db.query(Customer)
            .filter(Customer.id.in_(customer_ids))
            .all()
        )

        customers_by_id = {
            customer.id: customer for customer in customers
        }

    return [
        normalize_invoice_row(row, customers_by_id.get(row.get("customer_id")))
        for row in rows
    ]


@router.put("/invoice-promises/invoices/{invoice_id}")
def set_invoice_payment_promise(
    invoice_id: int,
    data: PaymentPromiseRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "cobrador"])),
):
    ensure_invoice_promise_columns()

    if not data.promise_date:
        raise HTTPException(
            status_code=400,
            detail="Ingresá la fecha de promesa de pago.",
        )

    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    columns = get_table_columns("invoices")

    payload = {
        "payment_promise_date": data.promise_date,
        "payment_promise_note": data.note or "",
        "payment_promise_status": "active",
        "payment_promise_created_at": now_string(),
    }

    payload = {
        key: value
        for key, value in payload.items()
        if key in columns
    }

    set_clause = ", ".join([f"{key} = :{key}" for key in payload.keys()])

    db.execute(
        text(f"UPDATE invoices SET {set_clause} WHERE id = :id"),
        {"id": invoice_id, **payload},
    )

    db.commit()

    row = get_invoice_row_or_404(db, invoice_id)
    customer = db.query(Customer).filter(Customer.id == row.get("customer_id")).first()

    return {
        "status": "ok",
        "message": "Promesa de pago registrada.",
        "invoice": normalize_invoice_row(row, customer),
    }


@router.put("/invoice-promises/invoices/{invoice_id}/clear")
def clear_invoice_payment_promise(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "cobrador"])),
):
    ensure_invoice_promise_columns()

    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    columns = get_table_columns("invoices")

    payload = {
        "payment_promise_date": "",
        "payment_promise_note": "",
        "payment_promise_status": "",
        "payment_promise_created_at": "",
    }

    payload = {
        key: value
        for key, value in payload.items()
        if key in columns
    }

    set_clause = ", ".join([f"{key} = :{key}" for key in payload.keys()])

    db.execute(
        text(f"UPDATE invoices SET {set_clause} WHERE id = :id"),
        {"id": invoice_id, **payload},
    )

    db.commit()

    row = get_invoice_row_or_404(db, invoice_id)
    customer = db.query(Customer).filter(Customer.id == row.get("customer_id")).first()

    return {
        "status": "ok",
        "message": "Promesa de pago cancelada.",
        "invoice": normalize_invoice_row(row, customer),
    }


@router.get("/invoices/{invoice_id}/comprobante-pdf")
def export_invoice_comprobante_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    invoice, customer = get_invoice_and_customer(db, invoice_id)

    company_data = get_company_settings_for_pdf(db)

    return stream_invoice_pdf(invoice, customer, company_data)


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
    invoice, customer = get_invoice_and_customer(db, invoice_id)

    company_data = get_company_settings_for_pdf(db)

    return stream_invoice_pdf(invoice, customer, company_data)


@router.get("/invoices/{invoice_id}/factura-pdf")
def export_selected_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    invoice, customer = get_invoice_and_customer(db, invoice_id)

    company_data = get_company_settings_for_pdf(db)

    return stream_invoice_pdf(invoice, customer, company_data)
