import type { BloatingStatus, Capability, MealType, Split, SymptomType } from "@/lib/types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "FitTrack AI";

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "morning_snack", label: "Morning snack" },
  { value: "lunch", label: "Lunch" },
  { value: "evening_snack", label: "Evening snack" },
  { value: "pre_workout", label: "Pre-workout" },
  { value: "post_workout", label: "Post-workout" },
  { value: "dinner", label: "Dinner" },
  { value: "other", label: "Other" },
];

export const MEAL_LABEL: Record<string, string> = Object.fromEntries(MEAL_TYPES.map((m) => [m.value, m.label]));

export const SPLITS: { value: Split; label: string }[] = [
  { value: "pull", label: "Pull" },
  { value: "push", label: "Push" },
  { value: "legs", label: "Legs" },
  { value: "cardio", label: "Cardio only" },
  { value: "full_body", label: "Full body" },
  { value: "rest", label: "Rest" },
  { value: "other", label: "Other" },
];

export const FILL_LEVELS = [
  { value: "quarter", label: "¼ full" },
  { value: "half", label: "½ full" },
  { value: "three_quarter", label: "¾ full" },
  { value: "full", label: "Full" },
  { value: "heaped", label: "Heaped / overflowing" },
];

export const COOKING_METHODS = ["", "boiled", "steamed", "grilled", "roasted", "sautéed", "stir-fried", "shallow-fried", "deep-fried", "baked", "raw", "tadka / tempered"];

export const OIL_LEVELS = ["", "none", "a few drops", "1 tsp", "1 tbsp", "2 tbsp", "generous / visible oil"];

export const BLOATING_OPTIONS: { value: BloatingStatus; label: string }[] = [
  { value: "none", label: "None" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

export const SYMPTOMS: { value: SymptomType; label: string }[] = [
  { value: "bloating", label: "Bloating" },
  { value: "gas", label: "Gas" },
  { value: "weakness", label: "Weakness" },
  { value: "low_energy", label: "Low energy" },
  { value: "acid_reflux", label: "Acid reflux" },
  { value: "poor_sleep", label: "Poor sleep" },
  { value: "soreness", label: "Soreness / DOMS" },
  { value: "headache", label: "Headache" },
  { value: "cramps", label: "Cramps" },
  { value: "nausea", label: "Nausea" },
  { value: "other", label: "Other" },
];

export const SEVERITY_LABELS = ["None", "Mild", "Moderate", "Severe"];

export const MUSCLE_GROUPS = ["Chest", "Back", "Lats", "Shoulders", "Rear delts", "Biceps", "Triceps", "Forearms", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Lower back"];

export const CAPABILITIES: Capability[] = ["chat", "vision", "reasoning", "fast", "long_context"];

export const AI_TASKS: { key: string; label: string; description: string }[] = [
  { key: "vision", label: "Vision", description: "Food photos and scanned medical reports" },
  { key: "reasoning", label: "Reasoning", description: "Coach advice, nutrition diagnostics, insights" },
  { key: "fast", label: "Fast extraction", description: "Quick parsing and simple extraction" },
  { key: "medical", label: "Medical", description: "Lab report biomarker extraction" },
];

export const REPORT_TYPES = ["Complete blood count (CBC)", "Lipid profile", "Liver function (LFT)", "Kidney function (KFT)", "Thyroid profile", "HbA1c / Glucose", "Vitamin D / B12", "Iron studies", "Hormone panel", "Full body checkup", "Other"];

export const DIET_TYPES = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "non_vegetarian", label: "Non-vegetarian" },
  { value: "vegan", label: "Vegan" },
];

export const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary (desk job, < 5k steps)" },
  { value: "light", label: "Lightly active (5–7.5k steps)" },
  { value: "moderate", label: "Moderately active (7.5–10k steps)" },
  { value: "active", label: "Very active (> 10k steps / physical job)" },
];

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
