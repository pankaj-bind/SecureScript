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
    # Assuming fonts/DejaVuSans.ttf exists in your api directory
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
    Generates a PDF report with improved formatting and including state columns.
    Handles distinct column sets for Audit vs. Hardening reports.
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
    title_style = ParagraphStyle(name='Title', parent=styles['h1'],
                                 fontName=f'{active_font}-Bold' if FONT_REGISTERED else 'Helvetica-Bold')
    # Increased leading and spaceAfter to handle multi-line state values
    cell_style = ParagraphStyle(name='Cell', parent=styles['Normal'],
                                fontName=active_font, fontSize=8, leading=10, spaceAfter=2)
    header_cell_style = ParagraphStyle(name='HeaderCell', parent=cell_style,
                                       textColor=colors.whitesmoke, fontSize=9)

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

    # Determine report type and set table configurations
    report_type_str = report_data.get('report_type', '')
    is_audit_report = 'Audit' in report_type_str and 'Hardening' not in report_type_str
    is_revert_report = 'Revert' in report_type_str

    if is_audit_report or is_revert_report:
        if is_revert_report:
            main_header_text = "Hardening Removal Result"
        else:
            main_header_text = "Audit Result"

        # 5 columns: Sr No, Policy Name, Current State, Passed, Failed
        col_widths = [40, 280, 100, 60, 60]
        col_names = ["Policy Name", "Current State"]

        table_header = [
            [Paragraph('<b>Sr No</b>', header_cell_style), Paragraph(f'<b>{col_names[0]}</b>', header_cell_style),
             Paragraph(f'<b>{col_names[1]}</b>', header_cell_style),
             Paragraph(f'<b>{main_header_text}</b>', header_cell_style), None],
            [None, None, None, Paragraph('<b>Passed</b>', header_cell_style), Paragraph('<b>Failed</b>', header_cell_style)]
        ]
        total_name_span_end_index = 2
        total_data_index_start = 3

    else:  # Hardening Report
        main_header_text = "Hardening Result"

        # 6 columns: Sr No, Policy Name, Previous State, Current State, Passed/Failed
        col_widths = [40, 180, 100, 100, 60, 60]
        col_names = ["Policy Name", "Previous State", "Current State"]

        table_header = [
            [Paragraph('<b>Sr No</b>', header_cell_style), Paragraph('<b>Policy Name</b>', header_cell_style),
             Paragraph('<b>Previous State</b>', header_cell_style), Paragraph('<b>Current State</b>', header_cell_style),
             Paragraph(f'<b>{main_header_text}</b>', header_cell_style), None],
            [None, None, None, None, Paragraph('<b>Passed</b>', header_cell_style), Paragraph('<b>Failed</b>', header_cell_style)]
        ]
        total_name_span_end_index = 3
        total_data_index_start = 4

    results_data = []
    policies = report_data.get('policies', [])
    for i, policy in enumerate(policies, 1):
        policy_name_paragraph = Paragraph(policy.get('name', 'N/A'), cell_style)
        passed_val = Paragraph(passed_char if policy['status'] == 'Passed' else "", cell_style)
        failed_val = Paragraph(failed_char if policy['status'] == 'Failed' else "", cell_style)

        row_content = [str(i), policy_name_paragraph]

        # Add state columns based on report type
        if is_audit_report or is_revert_report:
            # Audit & Revert Reports only display Current State
            current_state_paragraph = Paragraph(policy.get('current_state', 'N/A').replace('\n', '<br/>'), cell_style)
            row_content.extend([current_state_paragraph, passed_val, failed_val])
        else:
            # Hardening Reports display Previous and Current State
            previous_state_paragraph = Paragraph(policy.get('previous_state', 'N/A').replace('\n', '<br/>'), cell_style)
            current_state_paragraph = Paragraph(policy.get('current_state', 'N/A').replace('\n', '<br/>'), cell_style)
            row_content.extend([previous_state_paragraph, current_state_paragraph, passed_val, failed_val])

        results_data.append(row_content)

    # Calculate totals
    total_passed = sum(1 for p in policies if p['status'] == 'Passed')
    total_failed = len(policies) - total_passed

    # Total row data
    full_table_data = table_header + results_data
    total_name_span_end_index = 2 if (is_audit_report or is_revert_report) else 3
    total_data_index_start = 3 if (is_audit_report or is_revert_report) else 4

    total_row_data = [Paragraph('<b>Total</b>', cell_style)]
    total_row_data.extend([Paragraph(str(len(policies)), cell_style)] + [None] * (total_name_span_end_index - 1))
    total_row_data.extend([Paragraph(str(total_passed), cell_style), Paragraph(str(total_failed), cell_style)])

    full_table_data.append(total_row_data)

    results_table = Table(full_table_data, colWidths=col_widths, repeatRows=2)

    table_styles = [
        # Header background and Grid
        ('BACKGROUND', (0, 0), (-1, 1), colors.darkslategray),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),

        # Header Spanning (General)
        ('SPAN', (0, 0), (0, 1)),  # Sr No
        ('SPAN', (total_data_index_start, 0), (total_data_index_start + 1, 0)),  # Hardening/Audit Result Header

        # Total Row Spanning & Alignment
        ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
        ('SPAN', (1, -1), (total_name_span_end_index, -1)),
        ('ALIGN', (0, -1), (0, -1), 'CENTER'),
        ('ALIGN', (total_data_index_start, -1), (total_data_index_start + 1, -1), 'CENTER'),

        # Content Alignment
        ('ALIGN', (1, 2), (1, -2), 'LEFT'),
        ('ALIGN', (total_data_index_start, 2), (total_data_index_start + 1, -2), 'CENTER'),
    ]

    if not (is_audit_report or is_revert_report):
        # Hardening (6 columns)
        table_styles.extend([
            ('SPAN', (1, 0), (1, 1)),  # Policy Name
            ('SPAN', (2, 0), (2, 1)),  # Previous State
            ('SPAN', (3, 0), (3, 1)),  # Current State
            ('ALIGN', (2, 2), (3, -2), 'LEFT'),
        ])
    else:
        # Audit/Revert Report (5 columns)
        table_styles.extend([
            ('SPAN', (1, 0), (1, 1)),  # Policy Name
            ('SPAN', (2, 0), (2, 1)),  # Current State
            ('ALIGN', (2, 2), (2, -2), 'LEFT'),
        ])

    results_table.setStyle(TableStyle(table_styles))
    elements.append(results_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer
