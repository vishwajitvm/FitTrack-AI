// Plain-language help texts shown by the "?" icons (<InfoTip term="..." />).
// Every entry: what it is, why it matters, and an example from this user's own numbers
// (94.5 kg, 173 cm, Indian meals, gym return ~21:10, bedtime ~21:30).

export interface GlossaryEntry {
  title: string;
  body: string;
  example?: string;
}

export const GLOSSARY = {
  // ---------------------------------------------------------------- energy
  bmr: {
    title: "BMR — Basal Metabolic Rate",
    body: "The calories your body burns just to stay alive — breathing, heartbeat, brain, keeping warm — if you lay in bed all day. It is the biggest part of what you burn. We use the Mifflin–St Jeor formula, which needs your weight, height, age and sex.",
    example: "At 94.5 kg and 173 cm, a 30-year-old man would burn about 1,880 kcal a day doing nothing at all.",
  },
  neat: {
    title: "NEAT — everyday movement",
    body: "Calories burned by moving around outside the gym: walking, climbing stairs, standing, chores, fidgeting. It is worked out from your daily steps, or from your lifestyle setting when steps aren't logged.",
    example: "8,000 steps at 94.5 kg is roughly 300–350 kcal extra on top of your BMR.",
  },
  tef: {
    title: "TEF — digesting food",
    body: "Your body uses energy to digest what you eat. Protein costs the most to digest (~25% of its calories), carbs ~7.5%, fat ~2%. That is one reason high-protein diets help with fat loss.",
    example: "A 125 kcal whey shake (mostly protein) burns ~25 kcal just being digested; 125 kcal of fried rice burns only ~8 kcal.",
  },
  tdee: {
    title: "TDEE — total calories burned",
    body: "Everything you burn in a day: BMR + everyday movement (NEAT) + digestion (TEF) + exercise. Eat less than this and you lose fat; eat more and you gain.",
    example: "BMR 1,880 + NEAT 350 + TEF 110 + gym 637 ≈ 2,980 kcal on a training day like Day 1.",
  },
  deficit: {
    title: "Calorie deficit",
    body: "How many fewer calories you ate than you burned: TDEE minus food eaten. A positive number means you are in a deficit (losing); negative means a surplus. We never calculate it as \"food minus workout\" — that ignores most of what you burn.",
    example: "Burned ~2,980, ate 1,279 → deficit ≈ 1,700 kcal. Above ~1,000 kcal/day risks muscle loss and weak workouts.",
  },
  pending_biometrics: {
    title: "Pending Biometric Confirmation",
    body: "Your BMR, TDEE and true deficit can't be calculated until you enter your age and biological sex in Profile. Until then we show the calories you ate and burned in exercise, but not the deficit — a guess would be misleading.",
    example: "Open Profile → Basic → fill in Age and Sex → Save. The deficit appears everywhere instantly.",
  },
  met: {
    title: "MET — exercise intensity",
    body: "MET says how hard an activity is compared with sitting still (sitting = 1). Exercise calories ≈ MET × 3.5 × your weight in kg ÷ 200 × minutes.",
    example: "20 min incline treadmill (MET 4.5) at 94.5 kg: 4.5 × 3.5 × 94.5 ÷ 200 × 20 ≈ 149 kcal.",
  },
  lifting_once: {
    title: "Why lifting is counted once",
    body: "A weight session is one block of time — sets plus the rest between them. We count calories for the whole block once (e.g. 60 min at MET 4). Individual exercises like pull-ups or curls happen inside that hour, so they never add extra calories. Otherwise the same minutes would be counted twice.",
    example: "Day 1: 60-min pull session = ~397 kcal total, whether you did 6 exercises or 8.",
  },
  exercise_calories: {
    title: "Exercise burn",
    body: "Calories from logged training only: each cardio entry (MET × time) plus each lifting session block. Everyday walking is not included here — that is NEAT.",
    example: "Day 1: treadmill 149 + cycling 91 + 60-min lifting 397 = 637 kcal.",
  },

  // ---------------------------------------------------------------- nutrition
  protein_target: {
    title: "Protein target (g per kg)",
    body: "How much protein you should eat each day, scaled to your body weight. During fat loss, 1.6–2.0 g per kg protects your muscle and keeps you full.",
    example: "94.5 kg × 1.6–2.0 = about 151–189 g protein a day. Day 2 had 66 g — less than half.",
  },
  protein_per_kg: {
    title: "Protein per kg",
    body: "Today's protein divided by your body weight. Compare it with the 1.6–2.0 g/kg target.",
    example: "66 g ÷ 94.5 kg = 0.7 g/kg → far below 1.6.",
  },
  fibre: {
    title: "Fibre",
    body: "The part of plants your body can't digest. It feeds good gut bacteria, keeps you regular and full, and steadies blood sugar. Aim for 25–35 g a day.",
    example: "A bowl of dal (~8 g), an apple (~4 g) and a salad (~3 g) add 15 g. Day 2 had only ~5 g.",
  },
  whey_scoops: {
    title: "Whey scoops",
    body: "How many scoops of whey protein you logged today. One scoop ≈ 24–25 g protein. Whey concentrate contains some lactose, which can cause gas or bloating in sensitive people; isolate has almost none.",
    example: "2 scoops = ~49 g of your day's protein.",
  },
  macro_split: {
    title: "Macro split",
    body: "What share of your calories came from protein, carbs and fat. Protein and carbs have 4 kcal per gram, fat has 9.",
    example: "Day 1: 23% protein, 52% carbs, 25% fat. For fat loss, ~30–35% protein is better.",
  },
  calorie_range: {
    title: "Calorie range (low–high)",
    body: "Photo estimates can't be exact — oil, portion depth and hidden ingredients vary. So we show a likely low and high value, and the number in the middle is our best guess.",
    example: "Fried rice: 380–450 kcal, best guess 410. A spoon more tadka oil pushes it to the top of the range.",
  },
  confidence: {
    title: "Confidence score",
    body: "How sure the system is about an estimate, from 0 to 100%. It is higher when the food is easy to see, the portion is clear and the values match a nutrition database.",
    example: "A banana: ~90%. Mixed curry in a closed tiffin: maybe 50% — weigh it or add details to improve.",
  },
  data_source: {
    title: "Data source / verified",
    body: "Where the nutrition numbers came from. \"USDA\", \"IFCT\" (Indian Food Composition Tables) or \"Open Food Facts\" mean they were checked against a real database. \"AI estimate\" means only the AI's judgement was used.",
    example: "Boiled egg → USDA (verified). Home-style tadka rice → IFCT base + AI adjustment for oil.",
  },
  hidden_calories: {
    title: "Hidden calories",
    body: "Calories that are hard to see in a photo: cooking oil, ghee, butter, cream, cheese, sugar in chai, sauces. They often make the biggest difference between the estimate and reality.",
    example: "1 tbsp of tadka oil = ~120 kcal — as much as a whole banana.",
  },

  // ---------------------------------------------------------------- scan inputs
  container: {
    title: "Container preset",
    body: "Telling us what the food is served in (steel tiffin, katori, dinner plate…) gives the system a known size to compare against, so it can estimate volume and weight far more accurately.",
    example: "\"Full 750 ml tiffin of macaroni\" ≈ 400–450 g of pasta, not a vague \"one plate\".",
  },
  fill_level: {
    title: "Fill level",
    body: "How full the container is. Combined with the container size this gives the food's volume, which is converted to grams using the food's density.",
    example: "A 250 ml katori ¾ full of dal ≈ 190 ml ≈ 190 g.",
  },
  known_weight: {
    title: "Known weight",
    body: "If you weighed the food on a kitchen scale, enter it here. A real weight beats every estimate — the system then only has to work out what the food is.",
    example: "Weighed rice = 320 g → calories come straight from 320 g × kcal per 100 g.",
  },
  servings: {
    title: "Servings / portion eaten",
    body: "Servings: how many people's portions are in the photo. Portion eaten: how much of it you actually ate. Your log only counts what you ate.",
    example: "Photo of a shared plate (2 servings), you ate half → you're logged for 1 serving.",
  },
  cooking_method: {
    title: "Cooking method & oil",
    body: "Frying and tadka add a lot of fat that photos can't show. Telling us the method and how much oil was used makes the estimate much more accurate.",
    example: "Steamed idli ≈ 40 kcal each; the same batter as a ghee dosa ≈ 170 kcal.",
  },

  // ---------------------------------------------------------------- training
  readiness: {
    title: "Readiness score",
    body: "A 0–100 estimate of how ready your body is to train hard today. It combines sleep, energy, soreness, bloating and how well you ate over the last couple of days.",
    example: "71 = Good: train, but leave 1–2 reps in reserve. Below 45: lighter session or extra rest.",
  },
  volume_modifier: {
    title: "Volume modifier",
    body: "How much of your normal training volume (sets) to do today. 1.0 = your usual session; 0.85 = about 15% fewer sets. It drops when you are under-fed, under-slept or very sore, so you recover instead of digging a hole.",
    example: "×0.85 → if you usually do 4 sets of bench press, do 3 today.",
  },
  rpe: {
    title: "RPE — effort rating",
    body: "Rate of Perceived Exertion, 1–10. 10 = you couldn't do one more rep. 8 = you could have done ~2 more. An RPE cap tells you not to push beyond that today.",
    example: "Pull-ups at RPE 8–9 on Day 1 = close to failure on most sets.",
  },
  ppl_split: {
    title: "PPL split",
    body: "Push / Pull / Legs. Push = chest, shoulders, triceps. Pull = back, biceps, rear delts. Legs = quads, hamstrings, glutes, calves. Each muscle gets worked while the others recover.",
    example: "Mon Pull (Day 1) → Tue Push (Day 2) → Wed Legs → repeat, Sunday rest.",
  },
  rest_day: {
    title: "Rest day",
    body: "Your weekly no-gym day (Sunday). Muscles grow and the nervous system and gut recover on rest days — it is part of training, not a missed workout.",
    example: "On Sunday keep protein high, walk a little, and let digestion settle.",
  },

  // ---------------------------------------------------------------- alerts
  alert_levels: {
    title: "Alert colours",
    body: "Red = critical, fix today (e.g. eating under 1,000 kcal). Amber = needs attention (low protein, low fibre, skipped dinner). Green = on target. Blue = information or a missing input.",
    example: "Day 2: red crash-deficit alert, amber low-protein and low-fibre alerts.",
  },

  // ---------------------------------------------------------------- check-in
  checkin_energy: {
    title: "Energy level",
    body: "How energetic you feel right now, 1 (exhausted) to 10 (buzzing). Low energy after low-calorie days is a warning sign.",
    example: "Energy 4 after a 945 kcal day → readiness drops and training volume is reduced.",
  },
  checkin_readiness: {
    title: "Readiness (your own rating)",
    body: "Your gut feeling about training today, 1 (wrecked) to 10 (ready to set a personal best). It feeds the readiness score.",
  },
  sleep_quality: {
    title: "Sleep quality",
    body: "How rested you feel, 1–10, regardless of hours. Waking up with reflux or a bloated stomach usually means poor quality.",
    example: "7 hours but woke up twice with acid reflux after a late heavy meal → maybe a 4.",
  },
  bloating: {
    title: "Bloating",
    body: "How swollen or gassy your stomach feels: none, mild, moderate or severe. Logging it daily lets the system spot which foods or habits come before it.",
    example: "Mild bloating the morning after milk chai + whey concentrate at night.",
  },
  stress: {
    title: "Stress",
    body: "How stressed you feel, 1 (calm) to 10 (very stressed). High stress slows recovery and can upset digestion.",
  },
  mood: {
    title: "Mood",
    body: "How you feel emotionally, 1–10. Very low mood during a diet can mean the deficit is too aggressive.",
  },
  steps: {
    title: "Steps",
    body: "Your daily step count from a phone or watch. It sets your NEAT (everyday movement) calories for the day.",
    example: "4,000 steps vs 10,000 steps at 94.5 kg is a difference of roughly 250 kcal.",
  },
  water: {
    title: "Water",
    body: "How much you drank, in ml. Around 35 ml per kg is a common target — more on training days.",
    example: "94.5 kg × 35 ml ≈ 3.3 litres a day.",
  },
  soreness: {
    title: "Soreness (DOMS)",
    body: "Delayed-onset muscle soreness — the ache 1–2 days after training. Heavy soreness in a muscle means it hasn't recovered yet.",
    example: "Very sore lats on Wednesday after Monday's pull day → go lighter on rows.",
  },
  morning_weight: {
    title: "Morning weight",
    body: "Weigh yourself after the toilet, before eating or drinking. Daily weight jumps around by 0.5–1.5 kg from water and food in the gut — the weekly trend is what matters.",
    example: "94.5 kg on Day 1. A rice-heavy dinner can add 0.5 kg overnight that isn't fat.",
  },
  symptom_severity: {
    title: "Symptom severity (0–3)",
    body: "0 = none, 1 = mild (noticeable, doesn't bother you), 2 = moderate (uncomfortable, affects your day), 3 = severe (painful or stops you doing things).",
  },
  symptom_trigger: {
    title: "Suspected trigger",
    body: "What you think caused the symptom. It's just a note for you — the correlation engine checks your actual meals independently.",
    example: "\"Milk chai at 7 am\" or \"late whey concentrate\".",
  },

  // ---------------------------------------------------------------- gut correlation
  relative_risk: {
    title: "Relative risk",
    body: "How much more often a symptom appears on days with a trigger than on days without it. ×1 = no difference, ×2 = twice as often.",
    example: "Bloating on 6 of 8 lactose days (75%) vs 2 of 8 lactose-free days (25%) → ×3.",
  },
  correlation_strength: {
    title: "Strength labels",
    body: "Strong = clear, repeated pattern over enough days. Moderate = likely link worth testing. Weak = small difference, could be chance. Insufficient data = not enough days with and without the trigger to judge yet.",
  },
  insufficient_data: {
    title: "Insufficient data",
    body: "Patterns need several days both WITH and WITHOUT a trigger. With only a few days logged, any \"link\" could be a coincidence, so we don't rate it yet.",
    example: "Lactose was eaten on both Day 1 and Day 2 → no lactose-free days to compare against.",
  },
  correlation_causation: {
    title: "Correlation ≠ causation",
    body: "Two things happening together doesn't prove one causes the other. Late meals and milk chai might both happen on stressful days, and stress causes the bloating. Confirm a suspect by removing it for 1–2 weeks and seeing if the symptom goes away.",
  },

  // ---------------------------------------------------------------- medical
  biomarker_status: {
    title: "Biomarker status",
    body: "Whether a blood value is inside the lab's normal range (normal), below it (low), above it (high), or just at the edge (borderline). Unknown = the report had no range for it.",
    example: "Vitamin D 18 ng/mL with range 30–100 → low; common in India and linked to tiredness and slow recovery.",
  },
  reference_range: {
    title: "Reference range",
    body: "The range of values the lab considers normal for most healthy adults. It varies between labs, so always read the range printed on your own report.",
  },

  // ---------------------------------------------------------------- AI
  provider_priority: {
    title: "Provider priority",
    body: "The order in which AI services are tried. If the first one is busy, rate-limited or broken, the next one is tried automatically — you never see an error unless all of them fail.",
    example: "Groq (fast) → Gemini (good with photos) → OpenRouter → … → Ollama on your own computer.",
  },
  free_tier: {
    title: "Free tier",
    body: "The provider gives a free daily or per-minute allowance — no card needed for normal personal use. Limits differ; when one runs out, the router moves to the next.",
  },
  free_only_policy: {
    title: "Free-only AI",
    body: "Every provider listed here is free forever with just an API key — no credit card, no trial, nothing paid. Each has its own free quota; when one runs out (or is busy), the next model in line is used automatically. Ollama runs on your own computer and is slow, so it's only the last resort.",
    example: "Start with Google Gemini (best for meal photos), then add Groq and OpenRouter — all free, no credit card.",
  },
  privacy_note: {
    title: "Privacy on free plans",
    body: "Some free plans keep or learn from what you send. Read each provider's note: if it says prompts may be retained or used for training, leave it disabled if you'd rather not share meal or health details.",
  },
  api_key_storage: {
    title: "How keys are stored",
    body: "Keys you paste here are encrypted before they are saved in the database, and the full key is never sent back to the browser — you only see the first and last few characters. Keys from the backend .env file are shown as \"env\" and must be changed there.",
  },
  routing_tasks: {
    title: "Routing tasks",
    body: "Different jobs need different AI skills. Vision = reading food photos and scanned reports. Reasoning = coaching and analysis. Fast = quick, simple extraction. Medical = reading lab reports. Each task only uses models that have the needed capability.",
  },
  pinned_models: {
    title: "Pinned models",
    body: "Models you want tried first for a task, in your chosen order. If all pinned models fail, the router falls back to the normal provider priority list.",
    example: "Pin Gemini 2.5 Flash for vision because it reads Indian thalis well.",
  },
  ollama_last_resort: {
    title: "Ollama last resort",
    body: "Ollama runs AI models on your own computer — free and private, but slower and usually less accurate. With this on, it's used only when every cloud provider has failed.",
  },
  rate_limit: {
    title: "Rate-limit cooldown",
    body: "When a provider says \"too many requests\" (HTTP 429), it is paused for a short while and skipped automatically, so the next provider answers instead.",
  },
  call_status: {
    title: "Call statuses",
    body: "Success = answered. Rate limited = provider said slow down; skipped for a while. Timeout = took too long; next provider tried. Error = something else failed (bad key, model removed, provider down).",
  },
  capabilities: {
    title: "Model capabilities",
    body: "Chat = can hold a conversation. Vision = can look at images. Reasoning = better at multi-step thinking. Fast = answers very quickly. Long context = can read long documents like multi-page lab reports.",
  },
  ollama_pull: {
    title: "Downloading (pulling) a model",
    body: "\"Pull\" means download a model to the Ollama server. Small models (1–5 GB) run on most laptops; bigger ones need more RAM or a GPU. Downloads continue in the background.",
    example: "llama3.2-vision (~8 GB) can read food photos offline; qwen2.5:7b is good for coaching text.",
  },
  sync_models: {
    title: "Sync models",
    body: "Asks the provider which models it currently offers and adds any new ones to your list (disabled models stay disabled).",
  },

  // ---------------------------------------------------------------- data
  xlsx: {
    title: "Excel / CSV export & import",
    body: "Download everything as fitness_tracker.xlsx (6 sheets) or workout_tracker.csv to open in Excel or Google Sheets. You can edit the xlsx and import it back — matching rows are updated, nothing is deleted.",
  },

  // ---------------------------------------------------------------- body
  bmi: {
    title: "BMI",
    body: "Weight ÷ height². A rough screening number — it can't tell fat from muscle, so waist size and body-fat % are better guides.",
    example: "94.5 kg ÷ (1.73 m)² = 31.6.",
  },
  body_fat: {
    title: "Body fat (US Navy method)",
    body: "An estimate of body-fat % from tape measurements of waist and neck (plus hips for women). Measure in the morning, tape level, not pulled tight.",
  },

  protein_powder: {
    title: "Your protein powder",
    body: "Copy these numbers from your tub's nutrition label, per scoop (not per 100 g). They're used by the one-tap \"+ scoop\" button and when you type \"1 scoop whey\" or \"protein shake\".",
    example: "Seeded: 33 g scoop = 24.5 g protein, 125 kcal, 2.5 g carbs, 1.5 g fat.",
  },
  supplement_type: {
    title: "Concentrate vs isolate",
    body: "Whey concentrate still has some lactose (milk sugar) and can cause gas or bloating if you're sensitive. Whey isolate is filtered further — almost lactose-free, a little more protein per scoop. Plant protein has no lactose at all.",
    example: "Bloating after the 21:15 post-gym shake? Try an isolate for 2 weeks and watch the gut-health insights.",
  },

  // ---------------------------------------------------------------- machine learning
  ml_overview: {
    title: "Machine learning (ML) in this app",
    body: "Small statistical models that run on this computer, for free, in milliseconds — no AI key needed. They learn from YOUR data: your real calorie burn from weigh-ins, your training load, what drives your energy, your usual meals. AI chat models are only used for what really needs them.",
  },
  trend_weight: {
    title: "Trend weight",
    body: "Your 'true' weight with the daily water and food-in-the-gut noise filtered out. Each weigh-in nudges the trend a little instead of yanking it around, so one salty dinner doesn't look like a 1 kg gain.",
    example: "Weigh-ins of 94.5, 95.3 and 94.2 kg → trend ≈ 94.6 kg.",
  },
  kalman: {
    title: "Kalman filter (the smoothing)",
    body: "A classic method that combines two things every day: what your food log predicts your weight should be, and what the scale actually says. It trusts whichever is more reliable, so the trend line is steady but still follows real change.",
  },
  uncertainty_band: {
    title: "Uncertainty band",
    body: "The shaded area around a line shows the range the true value is very likely in (about 90% sure). Narrow band = confident; wide band = not enough data yet. It narrows as you log more days.",
  },
  outlier_weighin: {
    title: "Outlier weigh-in",
    body: "A weigh-in so far from the trend that it's almost certainly water, a late meal or a scale error. It's marked but ignored for the trend.",
    example: "Trend 94.5 kg, then 96.8 kg after a big biryani night → marked as an outlier.",
  },
  weight_rate: {
    title: "Rate of loss",
    body: "How fast your trend weight is changing, per week. For keeping muscle, 0.5–1% of body weight per week is ideal.",
    example: "At 94.5 kg: 0.5–0.9 kg per week is on track; faster than ~0.95 kg/week risks muscle.",
  },
  rate_status: {
    title: "Rate status",
    body: "Too fast = losing more than 1% a week (muscle-loss risk). On track = 0.5–1%. Slow = under 0.5%. Gaining = weight going up. Not enough weigh-ins = log a few more mornings.",
  },
  goal_eta: {
    title: "Goal date (ETA)",
    body: "If you keep losing at your current trend rate, roughly when you'd reach your target weight. It's a projection, not a promise — it moves as your rate changes.",
    example: "94.5 → 85 kg at 0.7 kg/week ≈ 14 weeks.",
  },
  plateau: {
    title: "Plateau",
    body: "Your trend weight hasn't really moved for 2+ weeks even though your log shows a deficit of 300+ kcal. Usually it's under-logged food (oil, chai sugar), water retention from new training, or your burn adapting.",
  },
  adaptive_tdee: {
    title: "Adaptive TDEE (your real burn)",
    body: "Your actual daily calorie burn, worked out from your food log and how your trend weight responds — 1 kg of fat ≈ 7,700 kcal. It doesn't need age or sex, and it adapts as your body changes. It needs ~2–3 weeks of logging and weigh-ins to become confident.",
    example: "Eating ~1,800 kcal and losing 0.5 kg/week → burn ≈ 1,800 + 550 = 2,350 kcal/day.",
  },
  tdee_source: {
    title: "Where the TDEE comes from",
    body: "Formula = calculated from BMR (age, sex, height, weight) + activity. Adaptive = learned from your weigh-ins and food log. Blended = a mix, weighted by how confident the adaptive estimate is. Pending = not enough information yet.",
  },
  adaptive_confidence: {
    title: "Confidence",
    body: "How sure the model is about your real burn, 0–100%. It rises with more logged days and weigh-ins. From 50% it can replace \"Pending Biometric Confirmation\".",
  },
  training_load: {
    title: "Training load",
    body: "How much work a session put on your body: minutes × how hard it felt (session RPE, 1–10). A 60-min session at RPE 7 = 420 load units.",
  },
  session_rpe: {
    title: "Session RPE",
    body: "One number for how hard the WHOLE session felt, 1–10, rated ~15 minutes after you finish. 5 = steady, 7 = hard, 9 = brutal. It turns minutes into training load.",
    example: "Day 1's 60-min pull session with pull-ups near failure ≈ RPE 8 → load 480.",
  },
  acute_load: {
    title: "Acute load (fatigue)",
    body: "Your average daily training load over roughly the last week. It reflects short-term fatigue.",
  },
  chronic_load: {
    title: "Chronic load (fitness)",
    body: "Your average daily training load over roughly the last 4 weeks. It reflects what your body is used to.",
  },
  acwr: {
    title: "ACWR — acute:chronic ratio",
    body: "This week's load divided by your 4-week average. 0.8–1.3 = optimal (steady progress). Above 1.3 = you ramped up quickly — recovery matters more. Below 0.8 = lighter than usual (fine for a deload).",
    example: "Jumping from 3 to 6 sessions in one week can push ACWR above 1.5.",
  },
  monotony: {
    title: "Monotony",
    body: "How similar your daily loads were this week (average ÷ variation). Above ~2 means every day is equally hard with no easy days — recovery suffers. Rest days lower it.",
  },
  strain: {
    title: "Strain",
    body: "Weekly load × monotony. High strain = lots of work with little variation. Use it to spot weeks that need an easier day.",
  },
  readiness_model: {
    title: "Personal readiness model",
    body: "After 14 days of check-ins, a small model learns how YOUR sleep, food, training and gut affect how energetic you feel the next morning. Before that, simple rules are used.",
  },
  r2: {
    title: "R² — how well it predicts",
    body: "0 to 1: how much of your day-to-day energy changes the model explains, tested on days it didn't train on. 0.3 is useful for human data; above 0.5 is strong.",
  },
  coefficients: {
    title: "What drives your energy",
    body: "Each bar shows how much your next-morning energy (1–10) tends to change when that factor is a bit higher than usual. Green = helps, red = hurts. Patterns, not proof.",
    example: "Sleep hours +0.8 → an extra hour or so of sleep usually means ~1 point more energy.",
  },
  meal_optimizer: {
    title: "Meal suggestions (optimizer)",
    body: "A maths solver picks up to 3 foods from the food library that best fill your remaining protein, calories and fibre — while respecting your diet type, intolerances and bedtime (only light food in the last 90 minutes).",
    example: "66 g protein so far → \"200 g paneer bhurji + 1 roti + cucumber salad\".",
  },
  remaining_macros: {
    title: "Remaining today",
    body: "Your targets minus what you've already logged today. Suggestions try to fill this gap without going over.",
  },
  meal_constraints: {
    title: "Rules applied",
    body: "Things the optimizer respected: your diet type, foods you're intolerant to, and the late-night rule (gym return 21:10 / bed 21:30 → only light, low-fat food).",
  },
  anomalies: {
    title: "Data-quality checks",
    body: "Automatic checks for entries that look wrong: calories that don't match the macros (4P + 4C + 9F), impossible portion weights, unusual days, odd weigh-ins and duplicated entries. Fixing them makes every number more accurate.",
    example: "A dal entry with 50 g protein but only 200 kcal can't be right.",
  },
  atwater: {
    title: "Calories vs macros check",
    body: "Calories should be roughly protein×4 + carbs×4 + fat×9. A big mismatch usually means a typo or a wrong serving.",
  },
  ml_only: {
    title: "Don't use AI (ML only)",
    body: "The photo is analysed only with on-device ML: duplicate detection, your saved meals, and dish recognition by image similarity. Free, private and fast — but less accurate for new or mixed dishes. Add a description or ingredients to help.",
  },
  analysis_method: {
    title: "How this was analysed",
    body: "AI + ML = an AI vision model with ML checks. ML only = no AI used. Duplicate photo = same photo as before, previous result reused. Your usual meal = it looks just like a meal you saved before, so that result was reused.",
  },
  image_quality: {
    title: "Photo quality",
    body: "Blurry or dark photos make portions and ingredients harder to judge. Retake in good light, from above at a slight angle, with the whole plate in frame.",
  },
  zero_shot: {
    title: "Dish guesses",
    body: "On-device image recognition comparing your photo with hundreds of food names. Treat the % as a hint, not a fact — it's often confused between similar Indian dishes.",
  },
  similar_meals: {
    title: "Similar past meals",
    body: "Meals you saved before that look most like this photo. The more meals you save, the better the app recognises your usual food.",
  },
  calibration: {
    title: "Personal portion calibration",
    body: "When you correct a weight after a photo, the app remembers it for that container and food type. Next time its estimate is adjusted — one correction nudges it, ten make it accurate for your kitchen.",
    example: "You corrected tiffin rice from 300 g to 360 g twice → future tiffin rice estimates are scaled up ~10%.",
  },
  parse_text: {
    title: "Quick add by typing",
    body: "Type what you ate in normal words. The app splits it into items, understands quantities like katori, roti, glass or scoop, and finds each food in the nutrition library — without AI.",
    example: "\"2 roti, 1 katori dal and a glass of buttermilk\" → 3 items, ~380 kcal.",
  },
  semantic_match: {
    title: "Search match type",
    body: "Meaning match = found by meaning (\"curd rice\" finds \"dahi chawal\"). Spelling match = found by similar letters (handles typos). Both = matched both ways.",
  },
  posterior_prob: {
    title: "How likely it's a real trigger",
    body: "The chance that the symptom really is more common on days with this food or habit than without, given your data so far. 95%+ is convincing; 70–85% is a hint worth testing.",
    example: "\"91% likely\" for lactose → bloating: test by switching to whey isolate for 2 weeks.",
  },
  credible_interval: {
    title: "Range of the difference",
    body: "How much more often (in percentage points) the symptom shows up with the trigger — the true value is very likely inside this range. If the range includes 0, there may be no real difference.",
    example: "+10 to +55 points → bloating is likely 10–55% more frequent on lactose days.",
  },
  p_value: {
    title: "p-value",
    body: "A classic statistics check: how surprising this pattern would be if the food had NO effect. Small (below 0.05) = unlikely to be pure chance. With few days it is usually large — that's normal.",
  },
  extraction_method: {
    title: "How values were read",
    body: "Rules = read directly from the report's text by pattern matching (fast, no AI). AI = read by an AI model (used for scanned photos). Rules + AI = both, cross-checked.",
  },
  ml_models: {
    title: "On-device models",
    body: "Two small models (~100–130 MB each) that run on your computer's CPU: a text model for smart food search and typed meals, and a vision model for recognising meal photos. Download once; they work offline.",
  },

  // ---------------------------------------------------------------- charts: how to read
  chart_intake_tdee: {
    title: "How to read: intake vs burn",
    body: "Green bars = calories eaten each day. Dark line = estimated total burn (TDEE). Shaded gap between them = your deficit. Bars well below the line = big deficit; bars above it = surplus.",
    example: "Aim for the bars to sit about 500–750 kcal under the line, not 1,500+.",
  },
  chart_macro_calories: {
    title: "How to read: calories by macro",
    body: "Each bar is one day's food, split by where the calories came from: protein (green), carbs (blue), fat (amber). A taller green part means a more protein-rich day.",
  },
  chart_protein_target: {
    title: "How to read: protein vs target",
    body: "Bars = grams of protein eaten each day. The shaded band = your 1.6–2.0 g/kg target zone. Bars reaching into the band = target hit.",
  },
  chart_weight: {
    title: "How to read: weight trend",
    body: "Dots = individual morning weigh-ins (these jump around with water and food). The smooth line = 7-day average — trust this line, not single days.",
  },
  chart_energy_stack: {
    title: "How to read: where calories are burned",
    body: "Each bar is one day's total burn split into BMR (resting), NEAT (movement), TEF (digestion) and exercise. The dot is what you ate. Dot below the bar top = deficit.",
  },
  chart_meal_timing: {
    title: "How to read: meal timing",
    body: "Each bubble is something you ate: left-to-right = time of day, height and size = calories. The red-shaded area is after 20:30 and the dashed lines mark gym return and bedtime — big bubbles there mean heavy food right before sleep (reflux and bloating risk).",
  },
  chart_macro_donut: {
    title: "How to read: macro split",
    body: "The ring shows what share of today's calories came from protein, carbs and fat. More green (protein) helps keep muscle during fat loss.",
  },
  chart_readiness: {
    title: "How to read: readiness gauge",
    body: "The needle shows today's readiness from 0 to 100. Red (0–44) = recover, amber (45–69) = train lighter, green (70+) = train normally.",
  },
  chart_workout_load: {
    title: "How to read: training load",
    body: "Stacked bars = minutes of lifting (dark) and cardio (blue) each day. The line = exercise calories. Gaps are rest days or unlogged days.",
  },
  chart_split: {
    title: "How to read: split distribution",
    body: "How your sessions are spread across Push, Pull, Legs and cardio over the period. A balanced PPL plan shows roughly equal slices.",
  },
  chart_checkin_timeline: {
    title: "How to read: symptoms vs food",
    body: "Grey bars = calories eaten, amber bars = calories eaten after 20:30. Green line = energy (1–10), red line = bloating (0–3). Look for red peaks the day after tall amber bars.",
  },
  chart_correlation: {
    title: "How to read: trigger strength",
    body: "Each bar is a possible trigger for a symptom. Bar length = relative risk (how many times more often the symptom shows up with that trigger). The line at ×1 means \"no difference\"; bars past ×2 are worth testing.",
  },
  chart_weight_kalman: {
    title: "How to read: weight trend (ML)",
    body: "Dots = your weigh-ins (crossed red dots = outliers that were ignored). Solid line = trend weight, shaded band = how sure we are. Dashed line = where you'll be if the current rate continues, ending at your target.",
  },
  chart_expenditure: {
    title: "How to read: real calorie burn",
    body: "Green bars = calories eaten each day. Solid line + band = your adaptive (real) burn and its likely range. Dashed line = the formula estimate. Bars below the burn line = deficit.",
  },
  chart_training_load: {
    title: "How to read: training load",
    body: "Bars = each day's load (minutes × session RPE). Amber line = acute (last ~week), dark line = chronic (last ~4 weeks). Purple line on the right axis = ACWR; the green strip 0.8–1.3 is the sweet spot.",
  },
  chart_coefficients: {
    title: "How to read: what drives your energy",
    body: "Bars to the right (green) raise next-morning energy, bars to the left (red) lower it. Longer bar = bigger effect, measured per typical change in that factor.",
  },
  chart_biomarker: {
    title: "How to read: biomarker trend",
    body: "The line shows the value in each report over time. The shaded green band is the normal reference range — points outside it are flagged.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
