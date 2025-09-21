# api/pdf_utils.py

import os
from io import BytesIO
import datetime
from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

# --- Font Registration with Fallback ---
FONT_NAME = 'DejaVuSans'
FALLBACK_FONT_NAME = 'Helvetica'
FONT_REGISTERED = False

try:
    # Ensure the path is constructed correctly relative to your project's BASE_DIR
    font_path = os.path.join(settings.BASE_DIR, 'api', 'fonts', 'DejaVuSans.ttf')
    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont(FONT_NAME, font_path))
        FONT_REGISTERED = True
        print("Successfully registered DejaVuSans font.")
    else:
        print(f"Warning: Font file not found at {font_path}. Using fallback.")
except Exception as e:
    print(f"Warning: Could not register '{FONT_NAME}' font. Using fallback. Error: {e}")


def generate_report_pdf(report_data):
    """
    Generates a PDF report with improved formatting and unicode support.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=50, bottomMargin=50, leftMargin=50, rightMargin=50)
    elements = []

    styles = getSampleStyleSheet()
    # Use the correct font based on whether it was registered successfully
    active_font = FONT_NAME if FONT_REGISTERED else FALLBACK_FONT_NAME

    # Use rich symbols only if the custom font was loaded
    passed_char = "✅" if FONT_REGISTERED else "Passed"
    failed_char = "❌" if FONT_REGISTERED else "Failed"

    # Define custom paragraph styles
    title_style = ParagraphStyle(name='Title', parent=styles['h1'], fontName=f'{active_font}-Bold' if FONT_REGISTERED else 'Helvetica-Bold')
    cell_style = ParagraphStyle(name='Cell', parent=styles['Normal'], fontName=active_font, fontSize=9, leading=11)
    header_cell_style = ParagraphStyle(name='HeaderCell', parent=cell_style, textColor=colors.whitesmoke)

    # Title
    title_text = report_data.get('report_type', 'Report')
    title = Paragraph(f"<b>{title_text}</b>", styles['h1'])
    elements.append(title)
    elements.append(Spacer(1, 20))

    # Metadata Table
    meta_data = [
        [Paragraph('<b>Username:</b>', cell_style), Paragraph(report_data.get('username', 'N/A'), cell_style)],
        [Paragraph('<b>Template ID:</b>', cell_style), Paragraph(report_data.get('template_id', 'N/A'), cell_style)],
        [Paragraph('<b>System Serial No:</b>', cell_style), Paragraph(report_data.get('serial_number', 'N/A'), cell_style)],
        [Paragraph('<b>Product Name:</b>', cell_style), Paragraph(report_data.get('product_name', 'N/A'), cell_style)],
        [Paragraph('<b>Benchmark Name:</b>', cell_style), Paragraph(report_data.get('benchmark_name', 'N/A'), cell_style)],
        [Paragraph('<b>Date:</b>', cell_style), Paragraph(report_data.get('date', 'N/A'), cell_style)],
        [Paragraph('<b>Time:</b>', cell_style), Paragraph(report_data.get('time', 'N/A'), cell_style)],
        [Paragraph('<b>Organization Name:</b>', cell_style), Paragraph(report_data.get('organization_name', 'N/A'), cell_style)]
    ]
    meta_table = Table(meta_data, colWidths=['30%', '70%'])
    meta_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    elements.append(meta_table)
    elements.append(Spacer(1, 20))

    # Determine table headers based on report type
    report_type_str = report_data.get('report_type', '')
    if 'Hardening Report' in report_type_str and 'Revert' not in report_type_str:
        main_header_text = "Hardening"
    elif 'Revert' in report_type_str:
        main_header_text = "Hardening Removal"
    else:
        main_header_text = "Audit"

    table_header = [
        [Paragraph('<b>Sr No</b>', header_cell_style), Paragraph('<b>Policy Name</b>', header_cell_style), Paragraph(f'<b>{main_header_text}</b>', header_cell_style), None],
        [None, None, Paragraph('<b>Passed</b>', header_cell_style), Paragraph('<b>Failed</b>', header_cell_style)]
    ]

    results_data = []
    policies = report_data.get('policies', [])
    for i, policy in enumerate(policies, 1):
        policy_name_paragraph = Paragraph(policy.get('name', 'N/A'), cell_style)
        passed_val = Paragraph(passed_char if policy['status'] == 'Passed' else "", cell_style)
        failed_val = Paragraph(failed_char if policy['status'] == 'Failed' else "", cell_style)
        results_data.append([str(i), policy_name_paragraph, passed_val, failed_val])

    # Combine all data for the table
    full_table_data = table_header + results_data
    total_passed = sum(1 for p in policies if p['status'] == 'Passed')
    total_failed = len(policies) - total_passed
    full_table_data.append([Paragraph('<b>Total</b>', cell_style), str(len(policies)), str(total_passed), str(total_failed)])

    results_table = Table(full_table_data, colWidths=[40, None, 60, 60], repeatRows=2)
    results_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkslategray),
        ('BACKGROUND', (0, 1), (-1, 1), colors.darkslategray),
        ('SPAN', (0, 0), (0, 1)),
        ('SPAN', (1, 0), (1, 1)),
        ('SPAN', (2, 0), (3, 0)),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
    ]))
    elements.append(results_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer