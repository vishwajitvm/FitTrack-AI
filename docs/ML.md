# Machine learning in FitTrack AI

FitTrack AI uses **classical ML, statistics and small on-device models first**, and calls an LLM only for what genuinely needs one: decomposing a never-seen-before meal photo into items, writing narrative coaching, and summarising unusual lab reports. Everything below runs locally, free, in milliseconds, and keeps working with no AI keys at all.

Code: `backend/app/services/ml/`. Endpoints: `/api/ml/*`, `/api/insights/*` (see [API.md](API.md#machine-learning--insights)).

## Where ML replaces or assists the LLM

| Feature | Technique | LLM still used? |
|---|---|---|
| Food search & matching | Semantic text embeddings (Nomic Embed v1.5, ONNX) + character-trigram hybrid, pgvector | No |
| Typed meals ("2 roti and 1 katori dal") | Rule-based quantity/unit parser + semantic food matching | Only if a part can't be matched confidently |
| Meal photo: duplicate photo | Perceptual hash (DCT pHash), Hamming distance | No — previous result reused |
| Meal photo: your usual meals | Image embeddings (Nomic Embed Vision v1.5) + k-nearest-neighbour over your saved meals | No when the match is very strong |
| Meal photo: what dish is it | Zero-shot image ↔ food-name similarity (shared embedding space) | Used as a hint for the LLM; used alone when no AI is configured |
| Meal photo: blurry/dark photo | Variance of the Laplacian, mean brightness | No |
| Portion size | Container geometry × density, **personally calibrated** from your corrections (Bayesian shrinkage per container × food type) | No |
| True TDEE ("adaptive expenditure") | Joint Kalman filter over trend weight and expenditure, 7,700 kcal/kg | No |
| Weight trend, rate, goal date, plateaus | Kalman-smoothed trend, robust regression, outlier gating | No |
| Training load | Session-RPE load, EWMA acute:chronic workload ratio, Foster monotony & strain | No |
| Readiness | Rules + personal ridge-regression model predicting tomorrow's energy (once ≥ 14 check-ins) | No |
| Gut-health triggers | Bayesian beta-binomial N-of-1 analysis (posterior probability, credible interval) + Fisher's exact test | Only for the optional narrative |
| Meal suggestions to close protein/calorie gaps | Mixed-integer linear programming (SciPy MILP) over the food library with diet, intolerance and bedtime constraints | No |
| Data-quality checks | Atwater consistency (4P+4C+9F), robust z-scores (MAD), weigh-in outliers, duplicate entries | No |
| Lab reports | Regex/rule extraction of ~45 biomarkers + reference ranges + rule-based implications | Only for scanned images or when few markers are found |
| Coach advice | Deterministic rules enriched with the insights above | Only when you press "Ask AI coach" |

## Models (downloaded once, cached in `data/models`)

| Key | Model | Size | Used for |
|---|---|---|---|
| `text` | `nomic-ai/nomic-embed-text-v1.5-Q` | ~0.13 GB | Semantic food search, text meal parsing, zero-shot dish labels |
| `vision` | `nomic-ai/nomic-embed-vision-v1.5-Q` | ~0.10 GB | Meal photo embeddings (same vector space as `text`) |

Both run on CPU through ONNX Runtime (via `fastembed`). They download on first use, or from **Settings → Machine learning**. Set `ML_ENABLED=false` to turn all of this off (the app falls back to trigram search and rules). Change models with `ML_TEXT_MODEL` / `ML_VISION_MODEL` (they must share an embedding space, e.g. the Qdrant CLIP pair).

## Algorithms

### Adaptive expenditure (Kalman filter)
State `x = [trend weight W (kg), expenditure E (kcal/day)]`.
Predict each day: `W ← W + (intake − E) / 7700`, `E ← E` (random walk). Days without logged food add extra uncertainty to `W` instead of assuming zero intake.
Update with the morning weigh-in `z = W + noise` (σ ≈ 0.6 kg for water/gut-content swings). Weigh-ins more than 3.5 σ from the prediction are flagged as outliers and ignored.
Prior: `E` starts at the formula TDEE (or 30 kcal/kg while age/sex are unknown) with σ = 500 kcal. The posterior σ gives a 90% interval and a confidence score. Once confidence ≥ 0.5 the adaptive value replaces "Pending Biometric Confirmation", and it is blended with the formula TDEE in proportion to confidence.

### Weight rate & goal forecast
Linear regression on the last 14 days of trend weight → kg/week and %/week. Status: losing > 1 %/week = *too fast (muscle-loss risk)*, 0.5–1 % = *on track*, 0–0.5 % = *slow*, gaining = *gaining*. ETA = (trend − target) ÷ rate. Plateau = |rate| < 0.1 kg/week for ≥ 14 days while the logged deficit is > 300 kcal.

### Training load
Session load = duration (min) × session RPE (lifting blocks use the session's RPE or 7; cardio uses MET-mapped RPE). Acute and chronic loads are EWMAs with λ = 2/(N+1), N = 7 and 28. ACWR zones: < 0.8 low, 0.8–1.3 optimal, 1.3–1.5 high, > 1.5 very high. Monotony = mean ÷ SD of the last 7 days' load; strain = weekly load × monotony. These describe load, not injury risk on their own.

### Personal readiness model
Features (previous day → next morning): sleep hours, sleep quality, intake ÷ formula TDEE, protein g/kg, ACWR, bloating score, sore muscle count, late-meal kcal. Ridge regression (standardised, λ = 1, closed form) predicting the 1–10 energy score. Activated after 14 labelled days; leave-one-out R² is reported. The readiness score blends rules and model 50/50 when active, and the coefficients are shown as "what drives your energy".

### Gut triggers (Bayesian N-of-1)
For each symptom × trigger: Beta(1,1) priors on the symptom rate with and without the trigger, posterior Beta(1+s, 1+n−s). We report P(rate_with > rate_without) by Monte-Carlo (20,000 draws), the 90% credible interval of the difference, and Fisher's exact p-value. Strength: *strong* if P ≥ 0.95 and difference ≥ 0.25; *moderate* if P ≥ 0.85; *weak* if P ≥ 0.7; otherwise not shown. Fewer than 3 days with or 2 without the trigger → *insufficient data*.

### Portion calibration
When you save a photo analysis after editing an item's weight, log(final ÷ estimated) is recorded per (container, food category). Future geometry estimates are multiplied by `exp(mean · n/(n+3))` — Bayesian shrinkage, so one correction nudges and ten corrections converge.

### Meal suggestions (MILP)
Variables: servings (0–3) of each eligible library food plus a binary "chosen" flag; at most 3 foods. Objective: minimise weighted shortfall/overshoot against the remaining protein, calories and fibre. Constraints: diet type, intolerances (lactose-free swaps whey isolate in), and after (bedtime − 90 min) only light, low-fat, non-fried foods ≤ 350 kcal. Three diverse solutions are produced by excluding previously chosen foods.

## Limits & honesty
- Zero-shot dish recognition is ~50–70 % top-1 on Indian dishes in published studies; it is a hint, never shown as fact. Personal k-NN improves as you save meals.
- Adaptive TDEE needs consistent logging; partially logged days bias it low. The UI shows the confidence.
- None of this is medical advice.
