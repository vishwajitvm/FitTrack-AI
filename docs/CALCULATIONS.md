# Calculation engines

Code: `backend/app/services/science/energy.py` (pure functions) and `backend/app/services/tracker/daily.py`.
Diagram: [`diagram/daily-energy-balance.mmd`](diagram/daily-energy-balance.mmd)

## BMR — Mifflin-St Jeor

- Men: `BMR = 10 × kg + 6.25 × cm − 5 × age + 5`
- Women: `BMR = 10 × kg + 6.25 × cm − 5 × age − 161`

Until **age and sex** are entered, BMR (and therefore TDEE and deficit) is shown as **Pending Biometric Confirmation**. An indicative range for a male aged 20–40 is shown meanwhile (94.5 kg / 173 cm → ~1,831–1,931 kcal).

The weight used each day is that day's morning weight, else the latest earlier weigh-in, else the profile weight.

## Exercise — MET formula

`kcal ≈ MET × 3.5 × kg ÷ 200 × minutes`

| Activity | MET range | Default |
|---|---|---|
| Brisk / incline treadmill walk | 4.0–5.0 | 4.5 |
| Stationary cycling (moderate) | 5.0–6.0 | 5.5 |
| General resistance training | 3.5–4.5 | 4.0 |
| Vigorous lifting / circuit | 5.0–6.0 | 5.5 |

**Anti-double-counting:** a lifting session is one `workout_sessions` row with a duration and MET. Exercises inside it (pull-ups, curls…) are `workout_logs` rows with `estimated_calories = 0`. Only the session block and cardio rows add calories.

Day 1 check: treadmill 20 min @4.5 = 148.8 · cycling 10 min @5.5 = 91.0 · lifting 60 min @4.0 = 396.9 → **636.7 ≈ 637 kcal**.

## NEAT

- With a step count (check-in, or profile average): `steps × 0.0005 × kg` (≈ 0.47 kcal/step at 94.5 kg).
- Otherwise a fraction of BMR by lifestyle (exercise excluded): sedentary 20%, light 30%, moderate 40%, active 50%. Default is sedentary until you set it.

## TEF (thermic effect of food)

`TEF = 0.25 × protein kcal + 0.075 × carb kcal + 0.02 × fat kcal`

## Adaptive TDEE (learned from your data)

A Kalman filter learns your real expenditure from logged intake and morning weight (7,700 kcal ≈ 1 kg). With confidence ≥ 0.5 it is blended with the formula TDEE in proportion to confidence; if age/sex are still missing it can replace "Pending Biometric Confirmation". Details: [ML.md](ML.md).

## TDEE and deficit

```
TDEE    = BMR + NEAT + TEF + Exercise
Deficit = TDEE − food intake        (positive = deficit, negative = surplus)
```

Never `intake − exercise`.

## Alerts (`services/coach/rules.py`)

| Level | Rule |
|---|---|
| 🟥 critical | Intake < 1,000 kcal on a completed day ("crash deficit") |
| 🟨 warning | Intake < max(1,200, 0.75 × BMR) (or < 1,500 while BMR is pending) — aggressive deficit |
| 🟨 warning | Deficit > 1,000 kcal |
| 🟨 warning | Protein < 1.6 g/kg (target 1.6–2.0 g/kg) |
| 🟨 warning | Fibre < 25 g |
| 🟨 warning | No dinner and no solid food after 17:00 |
| 🟨 warning | Meal > 400 kcal or > 15 g fat within 60 min of bedtime |
| 🟨 warning | Sleep below target, moderate/severe bloating, energy ≤ 4 |
| ℹ️ info | Rest day (Sunday), day in progress, workout duration missing, biometrics pending |
| 🟩 ok | Protein on target / everything on target |

A day counts as *complete* once it is in the past, after bedtime, or when a dinner/post-workout entry exists.

## Readiness & auto-regulation (`services/training/autoregulation.py`)

Start at 80, then: energy `(x − 7) × 5`, sleep < 6 h −15 / < 7 h −8, sleep quality `(x − 7) × 2`, sore muscles −4 each (max −15), bloating −3/−8/−15, and for each of the previous two days: crash intake −12, aggressive deficit −5, low protein −4.

| Score | Label | Volume | RPE cap |
|---|---|---|---|
| ≥ 75 | Primed | 100% | 9 |
| 60–74 | Good | 85% | 8 |
| 45–59 | Fatigued | 70% | 7 |
| < 45 | Depleted | 50% (or easy cardio) | 6 |

Split rotation: Pull → Push → Legs, continuing from the last logged session; Sunday is always rest.

## Gut-health correlations (`services/health/correlation.py`)

For each symptom and trigger, compare the symptom rate on days **with** the trigger (same day, or the previous evening after 18:00) vs **without**. Relative risk uses +0.5 smoothing.

| Strength | Condition |
|---|---|
| insufficient_data | < 3 days with trigger or < 2 without |
| strong | RR ≥ 2 and symptom on ≥ 50% of trigger days |
| moderate | RR ≥ 1.5 |
| weak | RR > 1.1 |

Triggers: lactose, gluten, refined flour, late meals, high-fat day (> 70 g), fried food, low fibre (< 15 g), legumes, crash intake (< 1,200 kcal), low protein (< 1.2 g/kg). Foods are tagged automatically from their names and ingredients (`services/nutrition/tagging.py`).
