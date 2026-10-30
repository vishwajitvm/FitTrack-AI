"""Answers without an AI provider: the question is matched to a topic and answered from the fact sheet,
in the same Markdown style the AI uses. Pure (facts in, text out)."""
from datetime import date

TOPICS = {
    "projection": ("lose", "loss", "losing", "reach", "target", "goal", "when will", "predict", "forecast", "project", "how long", "how much weight", "expect"),
    "food": ("eat", "ate", "food", "meal", "breakfast", "lunch", "dinner", "snack"),
    "workout": ("workout", "exercise", "gym", "train", "lift", "cardio", "push", "pull", "legs", "session"),
    "protein": ("protein", "whey"),
    "energy": ("calorie", "kcal", "deficit", "tdee", "burn", "maintenance", "intake"),
    "weight": ("weight", "weigh", "trend", "scale", "kg"),
    "recovery": ("sleep", "energy level", "mood", "stress", "bloat", "sore", "status", "feel"),
}


def topics_of(question: str) -> list[str]:
    q = question.lower()
    return [topic for topic, words in TOPICS.items() if any(w in q for w in words)]


def _n(v, digits=0) -> str:
    if v is None:
        return "—"
    return f"{v:,.{digits}f}"


def _day(iso) -> str:
    d = iso if isinstance(iso, date) else date.fromisoformat(str(iso))
    return d.strftime("%a %d %b")


def _signed(v, unit="kcal") -> str:
    if v is None:
        return "pending"
    return f"{v:,.0f} {unit} deficit" if v > 0 else f"{-v:,.0f} {unit} surplus"


def _projection_text(p: dict, title: str) -> list[str]:
    lines = [f"### {title}",
             f"- Eating **{_n(p['intake_kcal'])} kcal** against a burn of **{_n(p['burn_kcal'])} kcal** = **{_signed(p['deficit_kcal'])}** a day",
             f"- That is about **{_n(p['weekly_loss_kg_now'], 2)} kg a week** right now — {p['verdict']}", ""]
    if p["deficit_kcal"] <= 0:
        return lines[:3] + ["- At this intake you would not lose weight.", ""]
    lines += ["| In | Date | Simple estimate | Realistic estimate |", "|---|---|---|---|"]
    for w in p["weeks"]:
        reached = " (target reached)" if w.get("at_target") else ""
        lines.append(f"| {w['week']} week{'s' if w['week'] > 1 else ''} | {_day(w['date'])} | {w['constant']} kg | {w['adaptive']} kg{reached} |")
    if p["target_weight_kg"]:
        if p["target_date_adaptive"]:
            lines += ["", f"**Target {p['target_weight_kg']} kg:** around **{_day(p['target_date_adaptive'])} {p['target_date_adaptive'].year}** "
                          f"(simple estimate {_day(p['target_date_constant'])} {p['target_date_constant'].year})."]
        else:
            lines += ["", f"**Target {p['target_weight_kg']} kg:** not reached within two years at this rate."]
    return lines + [""]


def projection_answer(f: dict) -> list[str]:
    pr = f["projections"]
    base = pr["from_logged_average"]
    if not base:
        return ["**I can't project yet** — I need at least one complete day with food logged and your age and sex in Profile "
                "(to calculate your burn).", ""]
    out = [f"**At your current rate you'd lose about {_n(base['weekly_loss_kg_now'], 2)} kg a week** "
           f"(based on {pr['basis_days']} complete logged day{'s' if pr['basis_days'] != 1 else ''}).", ""]
    if pr["scenario"]:
        out += _projection_text(pr["scenario"], f"If you switch to {pr['scenario']['asked']}")
    out += _projection_text(base, "At your logged average")
    w = f["weight"]
    if w["observed_rate_kg_per_week"] is not None:
        out += [f"Your scale trend says **{_n(-w['observed_rate_kg_per_week'], 2)} kg/week** lost ({w['rate_status'].replace('_', ' ')})."]
    out += [f"_How: {pr['method']}_"]
    if pr["basis_days"] < 14:
        out += ["", f"_Only {pr['basis_days']} day(s) of data so far — this gets more accurate after ~2 weeks of complete logs and daily weigh-ins._"]
    return out


def day_answer(f: dict, iso: str, focus: str) -> list[str]:
    d = next((x for x in f["day_details"] if x["date"] == iso), None)
    if d is None:
        return [f"**Nothing is logged for {_day(iso)}.**", ""]
    e, i = d["energy"], d["intake"]
    out = [f"### {_day(iso)} · Day {d['day_number']}{' (rest day)' if d['is_rest_day'] else ''}",
           f"**{_n(i['calories'])} kcal eaten, {_n(i['protein'], 1)} g protein, {_n(e['exercise'])} kcal from exercise — {_signed(e['deficit'])}.**", ""]
    if focus in ("food", "day", "protein", "energy"):
        if d["foods"]:
            out += ["| Time | Meal | Food | kcal | Protein |", "|---|---|---|---|---|"]
            out += [f"| {x['time'] or '—'} | {x['meal'].replace('_', ' ')} | {x['food']} | {_n(x['kcal'])} | {_n(x['protein'], 1)} g |" for x in d["foods"]]
            out.append("")
        else:
            out += ["- No food logged.", ""]
    if focus in ("workout", "day"):
        if d["training_sessions"] or d["exercises"]:
            for s in d["training_sessions"]:
                out.append(f"- **{s['split'].title()} session** · {_n(s['minutes'])} min · {_n(s['kcal'])} kcal")
            for x in d["exercises"]:
                detail = f"{x['sets']} × {x['reps']}" if x["sets"] else f"{_n(x['minutes'])} min" if x["minutes"] else ""
                weight = f" @ {x['weight_kg']} kg" if x["weight_kg"] else ""
                out.append(f"- {x['exercise']} {detail}{weight}".rstrip())
            out.append("")
        else:
            out += ["- No workout logged.", ""]
    if focus in ("recovery", "day", "weight"):
        c = d["check_in"]
        bits = [f"weight **{d['morning_weight_kg']} kg**" if d["morning_weight_kg"] else None,
                f"sleep {c['sleep_hours']} h" if c.get("sleep_hours") else None,
                f"energy {c['energy_level']}/10" if c.get("energy_level") else None,
                f"mood {c['mood']}/10" if c.get("mood") else None,
                f"bloating {c['bloating_status']}" if c.get("bloating_status") else None]
        bits = [b for b in bits if b]
        out += [f"- Check-in: {', '.join(bits)}" if bits else "- No check-in that day."]
        if d["alerts"]:
            out.append(f"- Flags: {'; '.join(d['alerts'][:3])}")
        out.append("")
    return out


def averages_answer(f: dict, focus: str) -> list[str]:
    a = f["averages"]["last_7_complete_days"]
    if not a:
        return ["**No complete days logged yet**, so there are no averages to show.", ""]
    target = f["profile"]["protein_target_g"]
    out = [f"### Your averages ({a['days']} complete day{'s' if a['days'] != 1 else ''}, {_day(a['from'])} – {_day(a['to'])})",
           "| | Per day |", "|---|---|",
           f"| Eaten | {_n(a['intake_kcal'])} kcal |", f"| Burned (TDEE) | {_n(a['tdee_kcal'])} kcal |",
           f"| Balance | {_signed(a['deficit_kcal'])} |", f"| Exercise | {_n(a['exercise_kcal'])} kcal |",
           f"| Protein | {_n(a['protein_g'], 1)} g ({_n(a['protein_g_per_kg'], 2)} g/kg) |", ""]
    if focus == "protein" and target:
        gap = (target.get("target") or 0) - (a["protein_g"] or 0)
        out.append(f"**Protein target:** {target['min']}–{target['max']} g a day. "
                   + (f"You're about **{gap:.0f} g short** on average." if gap > 0 else "You're hitting it on average."))
    return out


def weight_answer(f: dict) -> list[str]:
    w = f["weight"]
    if not w["latest_weigh_in"]:
        return ["**No weigh-ins yet.** Weigh every morning after the toilet, before food, to see a trend.", ""]
    out = [f"**Latest weigh-in: {w['latest_weigh_in']['kg']} kg on {_day(w['latest_weigh_in']['date'])}** "
           f"({_n(w['change_since_start_kg'], 1)} kg since you started at {w['starting_weight_kg']} kg).", ""]
    if w["trend_weight_kg"] and w["weigh_ins"] >= 7:
        out.append(f"- Smoothed trend weight: **{w['trend_weight_kg']} kg**")
    if w["observed_rate_kg_per_week"] is not None:
        out.append(f"- Trend: {_n(w['observed_rate_kg_per_week'], 2)} kg/week ({w['rate_status'].replace('_', ' ')})")
    else:
        out.append(f"- {w['weigh_ins']} weigh-in(s) so far — a reliable trend needs about a week of daily weigh-ins.")
    if w["target_weight_kg"]:
        out.append(f"- Target: {w['target_weight_kg']} kg")
    return out + [""]


def overview_answer(f: dict) -> list[str]:
    out = [f"Here's where you stand on **{_day(f['today'])}** (day {f['profile']['days_since_start']}).", ""]
    out += averages_answer(f, "energy")
    out += weight_answer(f)
    return out


def answer(question: str, facts: dict) -> str:
    asked = [d.isoformat() for d in facts["asked_dates"]]
    topics = topics_of(question)
    topic = topics[0] if topics else "overview"
    lines: list[str] = []
    if topic == "projection":
        lines = projection_answer(facts)
    elif asked:
        focus = topic if len(topics) == 1 else "day"  # one topic → just that part, several → the whole day
        for iso in asked[:3]:
            lines += day_answer(facts, iso, focus)
    elif topic in ("food", "workout", "recovery") and facts["day_details"]:
        lines = ["Here's your most recent logged day:", ""] + day_answer(facts, facts["day_details"][0]["date"], topic)
    elif topic in ("energy", "protein"):
        lines = averages_answer(facts, topic)
    elif topic == "weight":
        lines = weight_answer(facts)
    else:
        lines = overview_answer(facts)
    return "\n".join(lines).strip()
