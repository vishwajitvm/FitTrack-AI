"""Regenerates docs/diagram/database-schema.drawio from the SQLAlchemy models.

Run from the backend folder after changing a model:
    python scripts/generate_schema_diagram.py
"""
import sys
from html import escape
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
OUTPUT = BACKEND.parent / "docs" / "diagram" / "database-schema.drawio"
sys.path.insert(0, str(BACKEND))
from app import models  # noqa
from app.db.base import Base

LAYOUT = {  # table: (col, row) on a grid
    "users": (0, 0), "daily_summaries": (1, 0), "food_logs": (2, 0), "food_analyses": (3, 0),
    "bio_feedback": (0, 1), "workout_sessions": (1, 1), "workout_logs": (2, 1), "food_library": (3, 1),
    "medical_reports": (0, 2), "biomarkers": (1, 2), "ai_providers": (2, 2), "ai_models": (3, 2),
    "llm_call_logs": (2, 3), "app_settings": (3, 3), "meal_memories": (0, 3), "portion_calibrations": (1, 3), "presets": (0, 4),
}
COLORS = {"users": "#DCFCE7", "daily_summaries": "#DBEAFE", "food_logs": "#FEF3C7", "food_analyses": "#FEF3C7",
          "food_library": "#FEF3C7", "workout_sessions": "#E0E7FF", "workout_logs": "#E0E7FF", "bio_feedback": "#FEE2E2",
          "medical_reports": "#FEE2E2", "biomarkers": "#FEE2E2", "ai_providers": "#F1F5F9", "ai_models": "#F1F5F9",
          "llm_call_logs": "#F1F5F9", "app_settings": "#F1F5F9", "meal_memories": "#EDE9FE", "portion_calibrations": "#EDE9FE", "presets": "#DCFCE7"}
W, ROW_H, HEAD = 260, 20, 30
col_y = {}
cells, edges, ids = [], [], {}
n = 2
row_heights = {}
for t in Base.metadata.sorted_tables:
    c, r = LAYOUT[t.name]
    row_heights[r] = max(row_heights.get(r, 0), HEAD + ROW_H * len(t.columns))
y_of_row = {}
acc = 40
for r in sorted(row_heights):
    y_of_row[r] = acc
    acc += row_heights[r] + 60
for t in Base.metadata.sorted_tables:
    c, r = LAYOUT[t.name]
    x, y = 40 + c * (W + 120), y_of_row[r]
    tid = f"t{n}"; n += 1
    ids[t.name] = tid
    h = HEAD + ROW_H * len(t.columns)
    cells.append(f'<mxCell id="{tid}" value="{t.name}" style="swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize={HEAD};fillColor={COLORS[t.name]};strokeColor=#0F172A;fontColor=#0F172A;rounded=1;arcSize=6;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{W}" height="{h}" as="geometry"/></mxCell>')
    for i, col in enumerate(t.columns):
        cid = f"c{n}"; n += 1
        ids[f"{t.name}.{col.name}"] = cid
        key = "PK " if col.primary_key else ("FK " if col.foreign_keys else "")
        ctype = str(col.type.compile()) if not col.name.endswith("embedding") else f"VECTOR({col.type.dim}) / JSON"
        null = "" if col.nullable is False or col.primary_key else "?"
        label = escape(f"{key}{col.name}{null} : {ctype}")
        style = "text;align=left;verticalAlign=middle;spacingLeft=6;fontSize=11;" + ("fontStyle=1;" if key else "")
        cells.append(f'<mxCell id="{cid}" value="{label}" style="{style}" vertex="1" parent="{tid}"><mxGeometry y="{HEAD + i * ROW_H}" width="{W}" height="{ROW_H}" as="geometry"/></mxCell>')
for t in Base.metadata.sorted_tables:
    for fk in t.foreign_keys:
        src = ids[f"{t.name}.{fk.parent.name}"]
        dst = ids[f"{fk.column.table.name}.{fk.column.name}"]
        eid = f"e{n}"; n += 1
        edges.append(f'<mxCell id="{eid}" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=1;endArrow=ERmandOne;startArrow=ERmany;strokeColor=#64748B;" edge="1" parent="1" source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"/></mxCell>')
xml = f'''<mxfile host="FitTrack AI" type="device">
  <diagram id="fittrack-db" name="Database schema">
    <mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1700" pageHeight="2200" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="title" value="FitTrack AI — PostgreSQL schema (generated from backend/app/models; ? = nullable)" style="text;fontSize=16;fontStyle=1;fontColor=#0F172A;" vertex="1" parent="1"><mxGeometry x="40" y="5" width="900" height="30" as="geometry"/></mxCell>
        {chr(10).join("        " + c for c in cells)}
        {chr(10).join("        " + e for e in edges)}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
'''
OUTPUT.write_text(xml, encoding="utf-8")
print(f"Wrote {OUTPUT} ({len(Base.metadata.sorted_tables)} tables, {len(edges)} relations)")
