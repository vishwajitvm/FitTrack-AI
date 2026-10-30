"""Smoke test: a text-based lab report PDF is read by the rule-based parser (no LLM), then deleted.

    docker compose exec -T backend python - < scripts/smoke_test_lab_report.py
"""
import httpx

API = "http://127.0.0.1:8000/api"
LINES = [
    "CITY DIAGNOSTICS - BLOOD PROFILE",
    "Hemoglobin (Hb) 13.1 g/dL 13.0 - 17.0",
    "HbA1c (Glycated Haemoglobin) 5.9 % 4.0 - 5.6",
    "Fasting Blood Sugar 108 mg/dL 70 - 100",
    "Total Cholesterol 212 mg/dL < 200",
    "HDL Cholesterol 38 mg/dL > 40",
    "LDL Cholesterol 141 mg/dL < 100",
    "Triglycerides 190 mg/dL < 150",
    "25-OH Vitamin D 14.2 ng/mL 30 - 100",
    "Vitamin B12 180 pg/mL 211 - 911",
    "TSH 2.1 uIU/mL 0.4 - 4.5",
]


def text_pdf(lines: list[str]) -> bytes:
    """Minimal single-page PDF with Helvetica text (no external libraries)."""
    stream = "BT /F1 11 Tf 50 780 Td 14 TL " + " ".join(f"({line}) Tj T*" for line in lines) + " ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = "%PDF-1.4\n", []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{obj}\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n" + "".join(f"{o:010d} 00000 n \n" for o in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"
    return out.encode("latin-1")


with httpx.Client(timeout=120) as client:
    created = client.post(f"{API}/medical/reports", files={"file": ("report.pdf", text_pdf(LINES), "application/pdf")},
                          data={"report_type": "Blood profile", "analyze": "false"})
    created.raise_for_status()
    report_id = created.json()["id"]
    report = client.post(f"{API}/medical/reports/{report_id}/analyze").json()
    print("status:", report["status"], "| method:", report["extraction_method"], "| provider:", report["provider"])
    for b in report["biomarkers"]:
        print(f"  {b['name']:20} {b['value']:>7} {b['unit'] or '':8} [{b['ref_low']}, {b['ref_high']}] {b['status']}")
    print("summary:", report["summary"])
    print("nutrition notes:", len(report["nutrition_implications"]), "| flags:", report["flags"][:3])
    client.delete(f"{API}/medical/reports/{report_id}")
    print("cleanup: report deleted")
