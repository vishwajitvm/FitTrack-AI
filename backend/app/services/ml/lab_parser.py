"""Rule-based lab report extraction — reads common Indian/international blood-test PDFs without an LLM.

For each line of extracted text, known biomarker names (with aliases) are matched, followed by
a numeric value, an optional unit and an optional reference range ("13.0 - 17.0", "< 200", "> 40").
When the report omits a range, typical adult reference ranges are used. Status and nutrition /
training implications come from rules. The LLM is only needed for scanned images or unusual
reports where few markers are recognised.
"""
import re

# key: (display name, category, aliases, unit, default_low, default_high)
MARKERS: dict[str, tuple] = {
    "hemoglobin": ("Hemoglobin", "blood_count", ["haemoglobin", "hemoglobin", "hb", "hgb"], "g/dL", 13.0, 17.0),
    "rbc": ("RBC count", "blood_count", ["rbc count", "rbc", "red blood cell"], "mill/cumm", 4.5, 5.5),
    "wbc": ("WBC count", "blood_count", ["wbc count", "total leucocyte count", "tlc", "wbc", "total wbc"], "cells/cumm", 4000, 11000),
    "platelets": ("Platelet count", "blood_count", ["platelet count", "platelets", "plt"], "lakh/cumm", 1.5, 4.1),
    "hematocrit": ("Hematocrit (PCV)", "blood_count", ["hematocrit", "haematocrit", "pcv", "packed cell volume"], "%", 40, 50),
    "mcv": ("MCV", "blood_count", ["mcv"], "fL", 83, 101),
    "esr": ("ESR", "inflammation", ["esr", "erythrocyte sedimentation rate"], "mm/hr", 0, 15),
    "crp": ("CRP", "inflammation", ["c-reactive protein", "crp", "hs-crp", "hscrp"], "mg/L", 0, 5),
    "glucose_fasting": ("Fasting glucose", "glucose", ["fasting blood sugar", "fasting glucose", "fbs", "glucose fasting", "fasting plasma glucose"], "mg/dL", 70, 100),
    "glucose_pp": ("Post-prandial glucose", "glucose", ["post prandial", "ppbs", "glucose pp", "2 hr glucose"], "mg/dL", 70, 140),
    "hba1c": ("HbA1c", "glucose", ["hba1c", "glycated haemoglobin", "glycated hemoglobin", "glycosylated"], "%", 4.0, 5.7),
    "insulin_fasting": ("Fasting insulin", "glucose", ["fasting insulin", "insulin fasting"], "µIU/mL", 2.6, 24.9),
    "total_cholesterol": ("Total cholesterol", "lipids", ["total cholesterol", "cholesterol total", "serum cholesterol", "cholesterol"], "mg/dL", 0, 200),
    "ldl": ("LDL cholesterol", "lipids", ["ldl cholesterol", "ldl-c", "ldl direct", "ldl"], "mg/dL", 0, 100),
    "hdl": ("HDL cholesterol", "lipids", ["hdl cholesterol", "hdl-c", "hdl"], "mg/dL", 40, 60),
    "triglycerides": ("Triglycerides", "lipids", ["triglycerides", "triglyceride", "tg"], "mg/dL", 0, 150),
    "vldl": ("VLDL cholesterol", "lipids", ["vldl"], "mg/dL", 0, 30),
    "tsh": ("TSH", "thyroid", ["tsh", "thyroid stimulating hormone"], "µIU/mL", 0.4, 4.5),
    "t3": ("Total T3", "thyroid", ["total t3", "t3 total", "triiodothyronine", "t3"], "ng/dL", 80, 200),
    "t4": ("Total T4", "thyroid", ["total t4", "t4 total", "thyroxine", "t4"], "µg/dL", 5.0, 12.0),
    "ft4": ("Free T4", "thyroid", ["free t4", "ft4"], "ng/dL", 0.8, 1.8),
    "alt": ("ALT (SGPT)", "liver", ["sgpt", "alt", "alanine aminotransferase"], "U/L", 0, 45),
    "ast": ("AST (SGOT)", "liver", ["sgot", "ast", "aspartate aminotransferase"], "U/L", 0, 40),
    "alp": ("Alkaline phosphatase", "liver", ["alkaline phosphatase", "alp"], "U/L", 40, 130),
    "ggt": ("GGT", "liver", ["ggt", "gamma gt", "gamma glutamyl"], "U/L", 0, 55),
    "bilirubin_total": ("Total bilirubin", "liver", ["total bilirubin", "bilirubin total", "bilirubin"], "mg/dL", 0.2, 1.2),
    "albumin": ("Albumin", "liver", ["albumin"], "g/dL", 3.5, 5.0),
    "total_protein": ("Total protein", "liver", ["total protein", "serum protein"], "g/dL", 6.0, 8.3),
    "creatinine": ("Creatinine", "kidney", ["serum creatinine", "creatinine"], "mg/dL", 0.7, 1.3),
    "urea": ("Urea", "kidney", ["blood urea", "urea"], "mg/dL", 15, 40),
    "bun": ("BUN", "kidney", ["bun", "blood urea nitrogen"], "mg/dL", 7, 20),
    "uric_acid": ("Uric acid", "kidney", ["uric acid", "serum uric acid"], "mg/dL", 3.5, 7.2),
    "egfr": ("eGFR", "kidney", ["egfr", "estimated gfr"], "mL/min/1.73m²", 90, 200),
    "sodium": ("Sodium", "minerals", ["sodium", "na+"], "mmol/L", 136, 145),
    "potassium": ("Potassium", "minerals", ["potassium", "k+"], "mmol/L", 3.5, 5.1),
    "calcium": ("Calcium", "minerals", ["serum calcium", "calcium"], "mg/dL", 8.6, 10.3),
    "magnesium": ("Magnesium", "minerals", ["magnesium"], "mg/dL", 1.7, 2.4),
    "iron": ("Serum iron", "minerals", ["serum iron", "iron"], "µg/dL", 60, 170),
    "ferritin": ("Ferritin", "minerals", ["ferritin"], "ng/mL", 30, 400),
    "tibc": ("TIBC", "minerals", ["tibc", "total iron binding capacity"], "µg/dL", 250, 450),
    "vitamin_d": ("Vitamin D (25-OH)", "vitamins", ["25-oh vitamin d", "25 hydroxy vitamin d", "vitamin d3", "vitamin d", "25(oh)d"], "ng/mL", 30, 100),
    "vitamin_b12": ("Vitamin B12", "vitamins", ["vitamin b12", "vit b12", "cyanocobalamin", "b12"], "pg/mL", 211, 911),
    "folate": ("Folate", "vitamins", ["folic acid", "folate"], "ng/mL", 3.0, 17.0),
    "testosterone": ("Testosterone (total)", "hormones", ["total testosterone", "testosterone"], "ng/dL", 264, 916),
    "cortisol": ("Cortisol", "hormones", ["cortisol"], "µg/dL", 6.2, 19.4),
}

IMPLICATIONS = {
    ("hemoglobin", "low"): ("Low haemoglobin: prioritise iron-rich foods (lean meat, eggs, dal, leafy greens) with vitamin C; discuss iron studies with a doctor.", "Expect lower endurance; keep cardio moderate until it is addressed."),
    ("ferritin", "low"): ("Low iron stores: combine iron foods with vitamin C, avoid tea/coffee around meals.", "Fatigue and poorer recovery are common with low ferritin."),
    ("vitamin_d", "low"): ("Low vitamin D: daily midday sun exposure and asking a doctor about D3 supplementation are common steps.", "Low vitamin D is linked to weaker muscle function and recovery."),
    ("vitamin_b12", "low"): ("Low B12 (common on vegetarian diets): dairy, eggs or a doctor-advised supplement.", "Low B12 can cause fatigue and tingling — report symptoms to a doctor."),
    ("hba1c", "high"): ("Raised HbA1c: favour high-fibre carbs, pair carbs with protein, cut sugary drinks and refined flour.", "Regular training improves insulin sensitivity — keep resistance training consistent."),
    ("glucose_fasting", "high"): ("Raised fasting glucose: reduce refined carbs and late heavy dinners.", "Walk 10–15 minutes after meals to blunt glucose spikes."),
    ("ldl", "high"): ("High LDL: more soluble fibre (oats, dal, fruit), fewer fried foods and less ghee/butter.", "Aerobic exercise helps lipid profile — keep the cardio sessions."),
    ("total_cholesterol", "high"): ("High total cholesterol: cut fried/oily foods, add fibre and nuts in moderation.", "Keep regular cardio."),
    ("triglycerides", "high"): ("High triglycerides: cut sugar, refined flour and late-night eating; add omega-3 sources.", "Fat loss itself lowers triglycerides — stay consistent."),
    ("hdl", "low"): ("Low HDL: regular exercise, nuts, and replacing refined carbs helps.", "Aerobic training raises HDL over time."),
    ("tsh", "high"): ("High TSH can slow metabolism — get thyroid function reviewed by a doctor before adjusting calories further.", "Fatigue may be thyroid-related; don't push through severe tiredness."),
    ("alt", "high"): ("Raised liver enzymes: avoid alcohol, reduce sugar and fried foods; fat loss usually helps (fatty liver).", "Avoid excessive supplements; discuss with a doctor."),
    ("ast", "high"): ("Raised AST can follow hard training or liver strain — recheck after 2–3 rest days if you trained heavily.", "Very hard sessions in the 48 h before a test can raise AST."),
    ("creatinine", "high"): ("High creatinine: discuss kidney function and protein intake with a doctor; stay hydrated.", "Creatine supplements and heavy training can raise creatinine."),
    ("uric_acid", "high"): ("High uric acid: limit organ meat, alcohol and sugary drinks; drink more water.", "Crash diets can raise uric acid — avoid extreme deficits."),
    ("testosterone", "low"): ("Low testosterone: avoid crash deficits, get 7–9 h sleep, adequate fats and zinc.", "Very aggressive deficits and poor sleep suppress testosterone."),
    ("crp", "high"): ("Raised CRP (inflammation): more fruit, vegetables and omega-3; fewer processed foods.", "Recheck when not ill and not after very hard training."),
}

_NUMBER = r"(\d+(?:[.,]\d+)?)"
_RANGE = re.compile(
    rf"{_NUMBER}\s*(?:-|–|to)\s*{_NUMBER}|(?:<|≤|upto|up to|less than)\s*{_NUMBER}|(?:>|≥|more than)\s*{_NUMBER}",
    re.IGNORECASE,
)


def _num(value: str) -> float:
    return float(value.replace(",", "."))


def _status(value: float, low: float | None, high: float | None) -> str:
    if low is not None and value < low:
        return "low"
    if high is not None and value > high:
        return "high"
    if low is not None and high is not None and high > low:
        margin = (high - low) * 0.05
        if value < low + margin or value > high - margin:
            return "borderline"
    return "normal"


def _alias_pattern(alias: str) -> re.Pattern:
    return re.compile(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", re.IGNORECASE)


_PATTERNS = [(key, alias, _alias_pattern(alias)) for key, m in MARKERS.items() for alias in sorted(m[2], key=len, reverse=True)]


def parse(text: str) -> list[dict]:
    found: dict[str, dict] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if len(line) < 3:
            continue
        lowered = line.lower()
        # The most specific (longest) alias on the line wins: "glycated haemoglobin" beats "haemoglobin".
        matches = [(len(alias), key, m) for key, alias, pattern in _PATTERNS if key not in found and (m := pattern.search(lowered))]
        if not matches:
            continue
        _, key, m = max(matches, key=lambda x: x[0])
        tail = line[m.end():]
        value_match = re.search(_NUMBER, tail)
        if not value_match:
            continue
        value = _num(value_match.group(1))
        after = tail[value_match.end():]
        name, category, _aliases, default_unit, d_low, d_high = MARKERS[key]
        unit_match = re.match(r"\s*([a-zA-Zµμ/%][\w/%µμ.²³^-]*)", after)
        unit = unit_match.group(1) if unit_match else default_unit
        low = high = None
        range_match = _RANGE.search(after)
        if range_match:
            g = range_match.groups()
            if g[0] is not None:
                low, high = _num(g[0]), _num(g[1])
            elif g[2] is not None:
                high = _num(g[2])
            elif g[3] is not None:
                low = _num(g[3])
        from_report = low is not None or high is not None
        if not from_report:
            low, high = d_low, d_high
        found[key] = {
            "key": key,
            "name": name,
            "category": category,
            "value": value,
            "value_text": value_match.group(1),
            "unit": unit[:40],
            "ref_low": low,
            "ref_high": high,
            "status": _status(value, low, high),
            "notes": None if from_report else "Reference range not found in report — typical adult range used.",
        }
    return list(found.values())


def implications(markers: list[dict]) -> tuple[list[str], list[str], list[str], str]:
    nutrition, training, flags = [], [], []
    for m in markers:
        rule = IMPLICATIONS.get((m["key"], m["status"]))
        if rule:
            nutrition.append(rule[0])
            training.append(rule[1])
        if m["status"] in ("low", "high"):
            flags.append(f"{m['name']} {m['status']} ({m['value_text']} {m['unit']})")
    abnormal = [m for m in markers if m["status"] in ("low", "high")]
    summary = (
        f"{len(markers)} markers read from the report. "
        + (f"{len(abnormal)} outside the reference range: " + ", ".join(m["name"] for m in abnormal) + ". "
           if abnormal else "All recognised markers are within their reference ranges. ")
        + "This is an automated reading, not medical advice — discuss abnormal values with your doctor."
    )
    return nutrition, training, flags, summary
