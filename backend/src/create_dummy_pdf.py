"""Generate a dummy PDF for testing the ingestion pipeline.

Run this script to create 'Company_Processes.pdf' in backend/data/documents/.
Requires: pypdf (or fpdf2 for creation). Uses a simple approach with reportlab-free method.
"""

import os
from pathlib import Path


def create_dummy_pdf(output_path: Path) -> None:
    """Create a multi-page dummy PDF with sample enterprise content."""
    try:
        from fpdf import FPDF
    except ImportError:
        # Fallback: create a minimal valid PDF manually
        _create_minimal_pdf(output_path)
        return

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Page 1: HR Policy
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Company HR Policy", ln=True, align="C")
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 12)
    hr_content = (
        "Human Resources Policy Document\n\n"
        "1. Work Hours: Standard work hours are 9:00 AM to 5:00 PM, Monday through Friday. "
        "Flexible working arrangements are available upon manager approval.\n\n"
        "2. Leave Policy: Employees are entitled to 20 days of paid annual leave, "
        "10 days of sick leave, and 5 days of personal leave per calendar year.\n\n"
        "3. Remote Work: Employees may work remotely up to 3 days per week. "
        "A remote work agreement must be signed and approved by the department head.\n\n"
        "4. Code of Conduct: All employees must adhere to the company code of conduct, "
        "which includes policies on harassment, discrimination, and workplace safety.\n\n"
        "5. Benefits: Full-time employees receive health insurance, dental coverage, "
        "401(k) matching up to 6%, and an annual professional development stipend of $2,000.\n\n"
        "6. Performance Reviews: Performance reviews are conducted bi-annually in June and December. "
        "Employees are evaluated on key performance indicators agreed upon with their managers.\n\n"
        "For questions about HR policies, contact hr@company.example.com."
    )
    pdf.multi_cell(0, 7, hr_content)

    # Page 2: Checkout Process
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "E-Commerce Checkout Process", ln=True, align="C")
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 12)
    checkout_content = (
        "Checkout Process Flow\n\n"
        "The checkout process follows these sequential steps:\n\n"
        "Step 1 - Browse Products: The user browses the product catalog and adds items to their cart.\n\n"
        "Step 2 - View Cart: The user reviews their shopping cart, adjusts quantities, "
        "and removes unwanted items.\n\n"
        "Step 3 - Login or Guest Checkout: The user either logs into their account "
        "or proceeds as a guest.\n\n"
        "Step 4 - Enter Shipping Information: The user provides their shipping address "
        "and selects a shipping method (Standard, Express, or Overnight).\n\n"
        "Step 5 - Payment: The user enters payment details. Accepted methods include "
        "credit card, PayPal, and bank transfer.\n\n"
        "Step 6 - Order Review: The user reviews the complete order including items, "
        "shipping, and total cost.\n\n"
        "Step 7 - Place Order: The user confirms and places the order.\n\n"
        "Step 8 - Confirmation: The system sends an order confirmation email with "
        "a tracking number. The order enters the fulfillment pipeline.\n\n"
        "Error Handling: If payment fails, the user is redirected back to the payment step. "
        "If an item goes out of stock during checkout, the user is notified and given the "
        "option to remove it or wait for restock."
    )
    pdf.multi_cell(0, 7, checkout_content)

    # Page 3: Engineering Org Chart
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Engineering Organization Structure", ln=True, align="C")
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 12)
    org_content = (
        "Engineering Department Hierarchy\n\n"
        "CTO: Sarah Chen\n"
        "  Reports to: CEO\n\n"
        "VP of Engineering: Michael Roberts\n"
        "  Reports to: Sarah Chen (CTO)\n\n"
        "Director of Backend Engineering: James Wilson\n"
        "  Reports to: Michael Roberts\n"
        "  Team Leads:\n"
        "    - API Team Lead: Lisa Park\n"
        "    - Data Team Lead: Raj Patel\n"
        "    - Infrastructure Team Lead: Ana Martinez\n\n"
        "Director of Frontend Engineering: Emily Zhang\n"
        "  Reports to: Michael Roberts\n"
        "  Team Leads:\n"
        "    - Web Team Lead: Chris Johnson\n"
        "    - Mobile Team Lead: Priya Sharma\n\n"
        "Director of QA: David Kim\n"
        "  Reports to: Michael Roberts\n"
        "  Team Leads:\n"
        "    - Automation Lead: Tom Brown\n"
        "    - Manual QA Lead: Maria Garcia\n\n"
        "Design Team (under VP of Product):\n"
        "  Head of Design: Alex Rivera\n"
        "    - UX Lead: Jordan Lee\n"
        "    - UI Lead: Sam Taylor\n"
        "    - Design Systems Lead: Casey Morgan\n\n"
        "The Design team collaborates closely with Frontend Engineering on all product features."
    )
    pdf.multi_cell(0, 7, org_content)

    # Page 4: Deployment Process
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Software Deployment Process", ln=True, align="C")
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 12)
    deploy_content = (
        "Deployment Process Flow\n\n"
        "Our deployment follows a CI/CD pipeline with the following stages:\n\n"
        "1. Developer pushes code to a feature branch on GitHub.\n\n"
        "2. A pull request (PR) is created and must be reviewed by at least 2 team members.\n\n"
        "3. Automated CI pipeline runs:\n"
        "   - Unit tests\n"
        "   - Integration tests\n"
        "   - Linting and code quality checks\n"
        "   - Security scanning (Snyk)\n\n"
        "4. Upon PR approval and all checks passing, the code is merged to the main branch.\n\n"
        "5. Merging to main triggers the CD pipeline:\n"
        "   - Docker image is built and pushed to the container registry.\n"
        "   - Staging deployment is triggered automatically.\n\n"
        "6. Staging environment runs smoke tests and integration tests.\n\n"
        "7. After staging validation (manual approval required), production deployment begins:\n"
        "   - Blue-green deployment strategy is used.\n"
        "   - Health checks verify the new version is healthy.\n"
        "   - Traffic is gradually shifted (canary release: 10% -> 50% -> 100%).\n\n"
        "8. Post-deployment monitoring:\n"
        "   - Error rates are monitored for 30 minutes.\n"
        "   - If error rate exceeds 1%, automatic rollback is triggered.\n"
        "   - Deployment success is reported to the #deployments Slack channel.\n\n"
        "Rollback Procedure: If issues are detected, run the rollback script which "
        "reverts to the previous Docker image tag and restores the database migration if needed."
    )
    pdf.multi_cell(0, 7, deploy_content)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))
    print(f"Created dummy PDF: {output_path}")


def _create_minimal_pdf(output_path: Path) -> None:
    """Create a minimal valid PDF without any external dependencies.

    This produces a simple but valid PDF that PyPDFLoader can parse.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    pages_content = [
        (
            "Company HR Policy\n\n"
            "Human Resources Policy Document\n\n"
            "1. Work Hours: Standard work hours are 9:00 AM to 5:00 PM, Monday through Friday. "
            "Flexible working arrangements are available upon manager approval.\n\n"
            "2. Leave Policy: Employees are entitled to 20 days of paid annual leave, "
            "10 days of sick leave, and 5 days of personal leave per calendar year.\n\n"
            "3. Remote Work: Employees may work remotely up to 3 days per week. "
            "A remote work agreement must be signed and approved by the department head.\n\n"
            "4. Code of Conduct: All employees must adhere to the company code of conduct, "
            "which includes policies on harassment, discrimination, and workplace safety.\n\n"
            "5. Benefits: Full-time employees receive health insurance, dental coverage, "
            "401(k) matching up to 6 percent, and an annual professional development stipend of $2,000.\n\n"
            "6. Performance Reviews: Performance reviews are conducted bi-annually in June and December.\n\n"
            "For questions about HR policies, contact hr@company.example.com."
        ),
        (
            "E-Commerce Checkout Process\n\n"
            "Checkout Process Flow\n\n"
            "Step 1 - Browse Products: The user browses the product catalog and adds items to their cart.\n"
            "Step 2 - View Cart: The user reviews their shopping cart and adjusts quantities.\n"
            "Step 3 - Login or Guest Checkout: The user logs in or proceeds as a guest.\n"
            "Step 4 - Enter Shipping Information: The user provides shipping address and selects shipping method.\n"
            "Step 5 - Payment: The user enters payment details (credit card, PayPal, or bank transfer).\n"
            "Step 6 - Order Review: The user reviews the complete order.\n"
            "Step 7 - Place Order: The user confirms and places the order.\n"
            "Step 8 - Confirmation: System sends order confirmation email with tracking number.\n\n"
            "Error Handling: If payment fails, the user is redirected back to the payment step."
        ),
        (
            "Engineering Organization Structure\n\n"
            "CTO: Sarah Chen (Reports to CEO)\n"
            "VP of Engineering: Michael Roberts (Reports to CTO)\n\n"
            "Director of Backend Engineering: James Wilson\n"
            "  API Team Lead: Lisa Park\n"
            "  Data Team Lead: Raj Patel\n"
            "  Infrastructure Team Lead: Ana Martinez\n\n"
            "Director of Frontend Engineering: Emily Zhang\n"
            "  Web Team Lead: Chris Johnson\n"
            "  Mobile Team Lead: Priya Sharma\n\n"
            "Director of QA: David Kim\n"
            "  Automation Lead: Tom Brown\n"
            "  Manual QA Lead: Maria Garcia\n\n"
            "Design Team (under VP of Product):\n"
            "  Head of Design: Alex Rivera\n"
            "  UX Lead: Jordan Lee\n"
            "  UI Lead: Sam Taylor\n"
            "  Design Systems Lead: Casey Morgan"
        ),
        (
            "Software Deployment Process\n\n"
            "1. Developer pushes code to a feature branch on GitHub.\n"
            "2. Pull request created, reviewed by at least 2 team members.\n"
            "3. CI pipeline runs: unit tests, integration tests, linting, security scanning.\n"
            "4. Code merged to main branch after approval.\n"
            "5. CD pipeline: Docker image built, pushed to registry, staging deployment.\n"
            "6. Staging smoke tests and integration tests run.\n"
            "7. Manual approval then production deployment (blue-green, canary release).\n"
            "8. Post-deployment monitoring for 30 minutes, auto-rollback if error rate exceeds 1 percent.\n\n"
            "Rollback: Revert to previous Docker image tag and restore database migration if needed."
        ),
    ]

    # Build a minimal valid PDF manually
    objects: list[str] = []
    offsets: list[int] = []
    content = b""

    header = b"%PDF-1.4\n"
    content += header

    # Create pages
    page_obj_ids: list[int] = []
    font_obj_id = 1
    pages_obj_id = 2
    catalog_obj_id = 3
    next_obj_id = 4

    # Object 1: Font
    offsets.append(len(content))
    obj = f"{font_obj_id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    content += obj.encode()

    # Create page content streams and page objects
    for page_text in pages_content:
        # Content stream
        stream_obj_id = next_obj_id
        next_obj_id += 1

        # Escape special characters for PDF text
        escaped = (
            page_text.replace("\\", "\\\\")
            .replace("(", "\\(")
            .replace(")", "\\)")
        )

        # Split into lines for TJ operator
        lines = escaped.split("\n")
        text_ops = f"BT\n/F1 11 Tf\n72 750 Td\n14 TL\n"
        for line in lines:
            text_ops += f"({line}) '\n"
        text_ops += "ET"

        stream_bytes = text_ops.encode()
        offsets.append(len(content))
        obj = (
            f"{stream_obj_id} 0 obj\n"
            f"<< /Length {len(stream_bytes)} >>\n"
            f"stream\n"
        )
        content += obj.encode()
        content += stream_bytes
        content += b"\nendstream\nendobj\n"

        # Page object
        page_obj_id = next_obj_id
        next_obj_id += 1
        page_obj_ids.append(page_obj_id)
        offsets.append(len(content))
        obj = (
            f"{page_obj_id} 0 obj\n"
            f"<< /Type /Page /Parent {pages_obj_id} 0 R "
            f"/MediaBox [0 0 612 792] "
            f"/Contents {stream_obj_id} 0 R "
            f"/Resources << /Font << /F1 {font_obj_id} 0 R >> >> >>\n"
            f"endobj\n"
        )
        content += obj.encode()

    # Object 2: Pages
    kids = " ".join(f"{pid} 0 R" for pid in page_obj_ids)
    offsets_insert_pos = len(b"%PDF-1.4\n") + len(
        f"{font_obj_id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n".encode()
    )
    # We need to rebuild with correct ordering. Let's just write all at once.

    # Rebuild properly
    content = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    offsets = []
    obj_count = 0

    # Obj 1: Font
    obj_count += 1
    offsets.append(len(content))
    content += b"1 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"

    # Obj 2: Pages (placeholder, rewrite later)
    pages_offset_index = len(offsets)
    obj_count += 1
    offsets.append(0)  # Will fix

    # Create content streams and pages
    page_obj_ids = []
    current_id = 3

    for page_text in pages_content:
        # Content stream object
        obj_count += 1
        stream_id = current_id
        current_id += 1

        escaped = (
            page_text.replace("\\", "\\\\")
            .replace("(", "\\(")
            .replace(")", "\\)")
        )
        lines = escaped.split("\n")
        text_ops = "BT\n/F1 11 Tf\n72 750 Td\n14 TL\n"
        for line in lines:
            text_ops += f"({line}) '\n"
        text_ops += "ET"
        stream_bytes = text_ops.encode()

        offsets.append(len(content))
        content += f"{stream_id} 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode()
        content += stream_bytes
        content += b"\nendstream\nendobj\n"

        # Page object
        obj_count += 1
        page_id = current_id
        current_id += 1
        page_obj_ids.append(page_id)
        offsets.append(len(content))
        content += (
            f"{page_id} 0 obj\n"
            f"<< /Type /Page /Parent 2 0 R "
            f"/MediaBox [0 0 612 792] "
            f"/Contents {stream_id} 0 R "
            f"/Resources << /Font << /F1 1 0 R >> >> >>\n"
            f"endobj\n"
        ).encode()

    # Now write Pages object (obj 2)
    kids = " ".join(f"{pid} 0 R" for pid in page_obj_ids)
    pages_bytes = (
        f"2 0 obj\n"
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_obj_ids)} >>\n"
        f"endobj\n"
    ).encode()
    offsets[pages_offset_index] = len(content)
    content += pages_bytes

    # Catalog
    obj_count += 1
    catalog_id = current_id
    current_id += 1
    offsets.append(len(content))
    content += f"{catalog_id} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".encode()

    # Cross-reference table
    xref_offset = len(content)
    content += b"xref\n"
    content += f"0 {obj_count + 1}\n".encode()
    content += b"0000000000 65535 f \n"

    # Sort offsets by object number - we need to map object IDs to offsets
    # Objects: 1 (font), 2 (pages), 3,4 (stream+page), 5,6 (stream+page), ...
    # offsets list: [obj1_off, pages_off, obj3_off, obj4_off, ...]
    for off in offsets:
        content += f"{off:010d} 00000 n \n".encode()

    content += b"trailer\n"
    content += f"<< /Size {obj_count + 1} /Root {catalog_id} 0 R >>\n".encode()
    content += b"startxref\n"
    content += f"{xref_offset}\n".encode()
    content += b"%%EOF\n"

    with open(output_path, "wb") as f:
        f.write(content)

    print(f"Created minimal dummy PDF: {output_path}")


if __name__ == "__main__":
    output = Path(__file__).resolve().parent.parent / "data" / "documents" / "Company_Processes.pdf"
    create_dummy_pdf(output)
