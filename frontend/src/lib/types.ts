// Mirrors docs/API.md — keep in sync with the backend schemas.

export type AlertLevel = "critical" | "warning" | "ok" | "info";

export interface Alert {
  level: AlertLevel;
  code: string;
  title: string;
  message: string;
}

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";
export type DietType = "vegetarian" | "eggetarian" | "non_vegetarian" | "vegan";
export type Experience = "beginner" | "intermediate" | "advanced";

export interface Profile {
  id: number;
  name: string | null;
  age: number | null;
  sex: Sex | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  current_weight_kg: number | null;
  goal: string | null;
  target_weight_kg: number | null;
  start_date: string | null;
  weekly_rate_kg: number | null;
  activity_level: ActivityLevel | null;
  avg_daily_steps: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  neck_cm: number | null;
  hip_cm: number | null;
  diet_type: DietType | null;
  allergies: string[];
  intolerances: string[];
  medical_conditions: string[];
  medications: string[];
  supplements: string[];
  training_split: string | null;
  training_experience: Experience | null;
  rest_day: string | null;
  wake_time: string | null;
  gym_start_time: string | null;
  gym_return_time: string | null;
  bedtime: string | null;
  protein_target_g_per_kg: number | null;
  water_target_ml: number | null;
  sleep_target_hours: number | null;
  preferred_cuisine: string | null;
  timezone: string | null;
  notes: string | null;
  // Protein powder (per-scoop values from the tub's label)
  protein_supplement_name?: string | null;
  protein_supplement_type?: "whey_concentrate" | "whey_isolate" | "plant" | "casein" | "other" | null;
  scoop_size_g?: number | null;
  protein_per_scoop_g?: number | null;
  calories_per_scoop?: number | null;
  carbs_per_scoop_g?: number | null;
  fat_per_scoop_g?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileMetrics {
  bmr: number | null;
  bmr_status: "ok" | "pending";
  missing_fields: string[];
  bmi: number | null;
  bmi_category: string | null;
  protein_target_g: { min: number; max: number; target: number } | null;
  calorie_target: number | null;
  tdee_estimate: number | null;
  maintenance_range: { low: number; high: number } | null;
  body_fat_estimate_pct: number | null;
  lean_mass_kg: number | null;
  water_target_ml: number | null;
  weight_change_kg: number | null;
  days_tracked: number | null;
}

export type BloatingStatus = "none" | "mild" | "moderate" | "severe";

export interface DailySummary {
  id: number | null;
  date: string;
  day_number: number | null;
  weekday: string | null;
  is_rest_day: boolean;
  morning_weight: number | null;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fibre: number;
  whey_scoops: number | null;
  protein_per_kg: number | null;
  estimated_exercise_calories: number | null;
  estimated_bmr: number | null;
  estimated_neat: number | null;
  estimated_tef: number | null;
  estimated_tdee: number | null;
  calorie_deficit: number | null;
  deficit_status: "ok" | "pending";
  readiness_score: number | null;
  energy_level: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  bloating_status: BloatingStatus | null;
  soreness_notes: string | null;
  steps: number | null;
  water_ml: number | null;
  mood: number | null;
  stress: number | null;
  notes: string | null;
  coach_advice: string | null;
  alerts: Alert[];
  // Extra fields returned by the backend
  weight_used_kg?: number | null;
  coach_advice_source?: string | null;
  has_workout?: boolean;
  food_count?: number;
  soreness_muscles?: string[];
  // ML additions (optional so older backends still work)
  adaptive_tdee?: number | null;
  tdee_source?: TdeeSource;
}

export interface CheckIn {
  morning_weight?: number | null;
  readiness_score?: number | null;
  energy_level?: number | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  bloating_status?: BloatingStatus | null;
  soreness_notes?: string | null;
  soreness_muscles?: string[];
  steps?: number | null;
  water_ml?: number | null;
  mood?: number | null;
  stress?: number | null;
  notes?: string | null;
}

export interface EnergyBreakdown {
  bmr: number | null;
  neat: number | null;
  tef: number | null;
  exercise: number | null;
  tdee: number | null;
  intake: number | null;
  deficit: number | null;
  status: string;
  notes: string[];
}

export interface MealBreakdown {
  meal_type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  items: number;
}

export interface DailyDetail {
  summary: DailySummary;
  foods: FoodLog[];
  sessions: WorkoutSession[];
  workouts: WorkoutLog[];
  biofeedback: BioFeedback[];
  energy: EnergyBreakdown;
  meal_breakdown: MealBreakdown[];
  macro_split: { protein_pct: number; carbs_pct: number; fat_pct: number };
}

export type MealType =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "evening_snack"
  | "pre_workout"
  | "post_workout"
  | "dinner"
  | "other";

export interface FoodLog {
  id: number;
  date: string;
  meal_type: MealType;
  time: string | null;
  timestamp: string | null;
  food_name: string;
  ingredients: string[];
  quantity: number | null;
  portion_unit: string | null;
  weight_grams: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  calories_low: number | null;
  calories_high: number | null;
  confidence_score: number | null;
  research_source: string | null;
  image_url: string | null;
  tags: string[];
  notes: string | null;
  analysis_id: number | null;
}

export type FoodLogCreate = Omit<FoodLog, "id" | "timestamp" | "analysis_id" | "image_url"> & {
  image_url?: string | null;
  analysis_id?: number | null;
};

export interface ContainerPreset {
  id: string;
  label: string;
  category: "plate" | "bowl" | "tiffin" | "cup" | "glass" | "box" | "other";
  volume_ml: number;
  diameter_cm: number | null;
  description: string;
}

export interface Per100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface AnalysisItem {
  name: string;
  ingredients: string[];
  cooking_method: string | null;
  estimated_weight_g: number;
  weight_low_g: number | null;
  weight_high_g: number | null;
  volume_ml: number | null;
  calories: number;
  calories_low: number | null;
  calories_high: number | null;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  per_100g: Per100g | null;
  source: string | null;
  confidence: number | null;
  tags: string[];
  notes: string | null;
}

export interface FoodAnalysis {
  id: number;
  created_at: string;
  image_url: string | null;
  status: "completed" | "failed";
  error: string | null;
  input: Record<string, unknown>;
  items: AnalysisItem[];
  totals: {
    calories: number;
    calories_low: number;
    calories_high: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre: number;
    weight_grams: number;
  };
  geometry: {
    container_label: string | null;
    container_volume_ml: number | null;
    fill_fraction: number | null;
    est_food_volume_ml: number | null;
    est_weight_g_from_geometry: number | null;
  } | null;
  portion_reasoning: string | null;
  hidden_calories: string[];
  warnings: string[];
  coach_note: string | null;
  overall_confidence: number | null;
  providers_used: { task: string; provider: string; model: string }[];
  sources: { name: string; url: string | null }[];
  saved: boolean;
  method?: AnalysisMethod;
  ml?: AnalysisML | null;
}

export type AnalysisMethod = "ai+ml" | "ml_only" | "duplicate" | "personal_match";

export interface AnalysisML {
  image_quality: { blur_score: number; is_blurry: boolean; brightness: number; is_dark: boolean; message: string | null } | null;
  duplicate_of: number | null;
  predictions: { label: string; score: number }[];
  similar_meals: { analysis_id: number; name: string; date: string; similarity: number; calories: number; image_url: string | null }[];
  calibration: { container_id: string | null; food_category: string | null; factor: number; samples: number } | null;
}

export interface NutritionHit {
  name: string;
  source: string;
  per_100g: Per100g;
  serving_hint: string | null;
  confidence: number | null;
  url: string | null;
  match?: "semantic" | "lexical" | "hybrid";
}

export type Split = "pull" | "push" | "legs" | "cardio" | "full_body" | "rest" | "other";

export interface WorkoutSession {
  id: number;
  date: string;
  split: Split;
  lifting_duration_min: number | null;
  lifting_met: number | null;
  estimated_calories: number | null;
  started_at: string | null;
  notes: string | null;
  session_rpe?: number | null;
}

export interface SetEntry {
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
}

export interface WorkoutLog {
  id: number;
  date: string;
  session_id: number | null;
  workout_type: "cardio" | "strength";
  exercise_name: string;
  target_muscle: string | null;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  sets_json: SetEntry[] | null;
  cardio_duration_min: number | null;
  lifting_duration_min: number | null;
  estimated_calories: number | null;
  met_value: number | null;
  rpe: number | null;
  notes: string | null;
}

export interface WorkoutDay {
  sessions: WorkoutSession[];
  logs: WorkoutLog[];
  total_calories: number;
}

export interface WorkoutHistoryRow {
  date: string;
  split: string | null;
  total_calories: number;
  cardio_min: number;
  lifting_min: number;
  exercises: number;
}

export interface WorkoutRecommendation {
  date: string;
  split_today: string | null;
  is_rest_day: boolean;
  readiness_score: number | null;
  readiness_label: string | null;
  volume_modifier: number | null;
  rpe_cap: number | null;
  recommendation: string;
  adjustments: string[];
  suggested_exercises: { name: string; sets: number | string; reps: string; rpe: number | string | null; notes: string | null }[];
  nutrition_timing: string[];
  acwr?: number | null;
  acwr_zone?: AcwrZone | null;
  readiness_mode?: ReadinessMode;
}

export interface ExerciseLibraryItem {
  name: string;
  target_muscle: string;
  split: string;
  default_sets: number;
  default_reps: string;
}

export interface MetReference {
  key: string;
  activity: string;
  met_low: number;
  met_high: number;
  default: number;
}

export type SymptomType =
  | "bloating"
  | "gas"
  | "weakness"
  | "low_energy"
  | "acid_reflux"
  | "poor_sleep"
  | "soreness"
  | "headache"
  | "cramps"
  | "nausea"
  | "other";

export interface BioFeedback {
  id: number;
  timestamp: string;
  date: string;
  symptom_type: SymptomType;
  severity: number;
  severity_label: string;
  trigger_suspect: string | null;
  body_part: string | null;
  notes: string | null;
}

export interface CorrelationFinding {
  symptom: string;
  trigger: string;
  label: string;
  days_with_trigger: number;
  symptom_with_trigger: number;
  days_without_trigger: number;
  symptom_without_trigger: number;
  rate_with: number | null;
  rate_without: number | null;
  relative_risk: number | null;
  strength: "insufficient_data" | "weak" | "moderate" | "strong";
  explanation: string;
  posterior_prob?: number | null;
  diff_low?: number | null;
  diff_high?: number | null;
  p_value?: number | null;
}

export interface Correlations {
  sample_days: number;
  symptoms_analysed: string[];
  findings: CorrelationFinding[];
  timeline: {
    date: string;
    energy: number | null;
    bloating_score: number | null;
    calories: number | null;
    protein: number | null;
    late_meal_kcal: number | null;
    lactose: boolean | number | null;
    gluten: boolean | number | null;
    refined_flour: boolean | number | null;
  }[];
  notes: string[];
  method?: string;
}

export interface AiText {
  text?: string;
  coach_advice?: string;
  provider: string | null;
  model: string | null;
}

export type BiomarkerStatus = "low" | "normal" | "high" | "borderline" | "unknown";

export interface Biomarker {
  id: number;
  report_id: number;
  name: string;
  category: string | null;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  status: BiomarkerStatus;
  notes: string | null;
}

export interface MedicalReport {
  id: number;
  report_date: string | null;
  report_type: string | null;
  lab_name: string | null;
  file_url: string | null;
  file_name: string | null;
  status: "uploaded" | "analyzing" | "analyzed" | "failed";
  summary: string | null;
  nutrition_implications: string[];
  training_implications: string[];
  flags: string[];
  biomarkers: Biomarker[];
  provider: string | null;
  model: string | null;
  notes: string | null;
  error: string | null;
  created_at: string;
  extraction_method?: "rules" | "ai" | "rules+ai";
}

export type BiomarkerTrends = Record<string, { date: string; value: number | null; unit: string | null; status: BiomarkerStatus }[]>;

export type Capability = "chat" | "vision" | "reasoning" | "fast" | "long_context";

export interface Provider {
  id: string;
  name: string;
  kind: "openai_compatible" | "ollama";
  base_url: string | null;
  default_base_url: string | null;
  website: string | null;
  key_url: string | null;
  free_tier: boolean;
  free_tier_note: string | null;
  requires_key: boolean;
  has_key: boolean;
  key_preview: string | null;
  key_source: "db" | "env" | null;
  extra_fields: { key: string; label: string }[];
  extra: Record<string, string>;
  enabled: boolean;
  priority: number;
  is_local: boolean;
  last_status: "ok" | "error" | "rate_limited" | null;
  last_error: string | null;
  last_checked_at: string | null;
  models_count: number;
  enabled_models_count: number;
}

export interface Model {
  id: number;
  provider_id: string;
  model_id: string;
  display_name: string;
  capabilities: Capability[];
  context_window: number | null;
  free: boolean;
  enabled: boolean;
  priority: number;
  custom: boolean;
}

export interface PinnedModel {
  provider_id: string;
  model_id: string;
}

export interface TaskRouting {
  capability: Capability;
  pinned: PinnedModel[];
}

export interface Routing {
  tasks: Record<string, TaskRouting>;
  ollama_last_resort: boolean;
  timeout_seconds: number;
  max_attempts: number;
}

export interface RoutePreviewItem {
  provider_id: string;
  provider_name: string;
  model_id: string;
  display_name: string;
}

export interface Attempt {
  provider: string;
  model: string;
  status: string;
  error: string | null;
  latency_ms: number | null;
}

export interface PlaygroundResult {
  text: string;
  provider: string | null;
  model: string | null;
  attempts: Attempt[];
}

export interface LLMCallLog {
  id: number;
  created_at: string;
  task: string;
  provider_id: string;
  model_id: string;
  status: "success" | "rate_limited" | "error" | "timeout";
  latency_ms: number | null;
  error: string | null;
}

export interface AiStats {
  providers_total: number;
  providers_configured: number;
  models_total: number;
  models_enabled: number;
  calls_24h: number;
  success_rate_24h: number | null;
}

export interface OllamaStatus {
  reachable: boolean;
  base_url: string;
  version: string | null;
  error: string | null;
}

export interface OllamaModel {
  name: string;
  size: number;
  size_human: string;
  modified_at: string | null;
  family: string | null;
  parameter_size: string | null;
  quantization: string | null;
  registered: boolean;
}

export interface OllamaRunning {
  name: string;
  size_human: string;
  expires_at: string | null;
}

export interface OllamaLibraryItem {
  name: string;
  description: string;
  size_human: string;
  capabilities: string[];
  recommended_for: string;
}

export interface PullJob {
  job_id: string;
  name: string;
  status: "queued" | "pulling" | "completed" | "failed" | "cancelled";
  detail: string | null;
  completed: number | null;
  total: number | null;
  percent: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface IntegrationInfo {
  label: string;
  has_key: boolean;
  preview: string | null;
  source?: "db" | "env" | null;
  help_url: string | null;
}

export interface AppSettings {
  integrations: Record<string, IntegrationInfo>;
  app: Record<string, unknown>;
  paths: Record<string, unknown>;
}

export interface Health {
  status: string;
  db: string;
  redis: string;
  version: string;
}

export interface Dashboard {
  profile_metrics: ProfileMetrics;
  today: DailySummary;
  week: DailySummary[];
  weight_trend: { date: string; weight: number }[];
  alerts: Alert[];
  recommendation: WorkoutRecommendation | null;
  ai_status: { configured_providers: number; enabled_models: number; ollama_reachable: boolean };
}

// ---------------------------------------------------------------- machine learning & insights

export type TdeeSource = "formula" | "adaptive" | "blended" | "pending";
export type RateStatus = "too_fast" | "on_track" | "slow" | "gaining" | "insufficient_data";
export type AcwrZone = "low" | "optimal" | "high" | "very_high";
export type ReadinessMode = "rules" | "personal_model";

export interface MLModelInfo {
  key: string;
  name: string;
  model_id: string;
  purpose: string;
  size_mb: number | null;
  state: "not_downloaded" | "loading" | "ready" | "error" | "disabled";
  error: string | null;
}

export interface MLStatus {
  enabled: boolean;
  models: MLModelInfo[];
  features: Record<string, boolean>;
  stats: { saved_meal_embeddings: number; portion_calibrations: number; readiness_samples: number };
}

export interface InsightsSummary {
  trend_weight: number | null;
  rate_kg_per_week: number | null;
  rate_status: RateStatus;
  eta_date: string | null;
  adaptive_tdee: number | null;
  adaptive_confidence: number;
  tdee_source: TdeeSource;
  acwr: number | null;
  acwr_zone: AcwrZone | null;
  readiness_mode: ReadinessMode;
  anomalies_count: number;
}

export interface WeightInsight {
  points: { date: string; weight: number | null; trend: number | null; lower: number | null; upper: number | null; outlier: boolean }[];
  trend_weight: number | null;
  rate_kg_per_week: number | null;
  rate_pct_per_week: number | null;
  rate_status: RateStatus;
  target_weight: number | null;
  forecast: { eta_date: string | null; days_remaining: number | null; projected: { date: string; weight: number }[] } | null;
  plateau: { detected: boolean; since: string | null; message: string };
  notes: string[];
}

export interface ExpenditureInsight {
  formula_tdee: number | null;
  adaptive_tdee: number | null;
  adaptive_low: number | null;
  adaptive_high: number | null;
  confidence: number;
  blended_tdee: number | null;
  tdee_source: TdeeSource;
  days_used: number;
  weigh_ins_used: number;
  logged_days: number;
  points: { date: string; intake: number | null; expenditure: number | null; low: number | null; high: number | null; trend_weight: number | null }[];
  notes: string[];
}

export interface TrainingLoadInsight {
  points: { date: string; load: number; acute: number; chronic: number; acwr: number | null }[];
  acwr: number | null;
  acwr_zone: AcwrZone | null;
  monotony: number | null;
  strain: number | null;
  weekly_load: number;
  notes: string[];
}

export interface ReadinessModelInfo {
  mode: ReadinessMode;
  samples: number;
  min_samples: number;
  r2: number | null;
  coefficients: { feature: string; label: string; weight: number }[];
  prediction_today: number | null;
  notes: string[];
}

export type MealSlot = "now" | "dinner" | "post_workout" | "snack";

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface MealSuggestionItem extends Macros {
  food: string;
  servings: number;
  grams: number;
}

export interface MealSuggestion {
  title: string;
  items: MealSuggestionItem[];
  totals: Macros;
  reason: string;
}

export interface MealSuggestions {
  date: string;
  slot: MealSlot;
  /** The optimizer only targets calories, protein and fibre, so carbs/fat may be null. */
  remaining: { [K in keyof Macros]: number | null };
  constraints: string[];
  suggestions: MealSuggestion[];
  method: string;
}

export interface Anomaly {
  date: string;
  kind: "atwater_mismatch" | "impossible_density" | "unusual_day" | "weight_outlier" | "duplicate_entry";
  severity: "warning" | "info";
  message: string;
  ref_id: number | null;
}

export interface ParsedItem extends Macros {
  text: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
  source: string | null;
  confidence: number | null;
  tags: string[];
}

export interface ParsedMeal {
  items: ParsedItem[];
  unparsed: string[];
  confidence: number;
  needs_ai: boolean;
  method: string;
}

// ---------------------------------------------------------------- quick logging: presets, repeat & copy

export type PresetKind = "workout" | "meal";

export interface PresetSummary {
  items?: number | null;
  calories?: number | null;
  protein?: number | null;
  exercises?: number | null;
  cardio_min?: number | null;
  lifting_min?: number | null;
}

export interface WorkoutPresetExercise {
  exercise_name: string;
  target_muscle: string | null;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  /** May be a range string like "8-9". */
  rpe: number | string | null;
  sets_json: SetEntry[] | null;
  /** Only in edited payloads sent to /apply: not logged when true. */
  skip?: boolean;
  /** Only in prefill responses. The backend may send just {date, suggestion}. */
  last?: Partial<LastPerformance> | null;
  last_performance?: LastPerformance | null;
  suggestion?: LastPerformance["suggestion"];
}

export interface WorkoutPresetCardio {
  exercise_name: string;
  cardio_duration_min: number | null;
  met_value: number | null;
  rpe: number | null;
  skip?: boolean;
}

export interface WorkoutPayload {
  session: { split: Split; lifting_duration_min: number | null; lifting_met: number | null; session_rpe: number | null } | null;
  cardio: WorkoutPresetCardio[];
  exercises: WorkoutPresetExercise[];
}

export interface MealPresetItem {
  food_name: string;
  quantity: number | null;
  portion_unit: string | null;
  weight_grams: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  ingredients: string[];
  tags: string[];
}

export interface MealPayload {
  meal_type: MealType;
  items: MealPresetItem[];
}

export interface Preset {
  id: number;
  kind: PresetKind;
  name: string;
  icon: string | null;
  color: string | null;
  split: Split | null;
  meal_type: MealType | null;
  payload: WorkoutPayload | MealPayload;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  summary: PresetSummary;
}

export interface PresetCreate {
  kind: PresetKind;
  name: string;
  icon?: string | null;
  color?: string | null;
  split?: Split | null;
  meal_type?: MealType | null;
  payload: WorkoutPayload | MealPayload;
}

export interface PresetPrefill {
  preset: Preset;
  payload: WorkoutPayload | MealPayload;
}

export interface EntryIds {
  food_ids?: number[];
  workout_log_ids?: number[];
  session_ids?: number[];
}

export interface AppliedEntries {
  food_ids: number[];
  workout_log_ids: number[];
  session_ids: number[];
  summary: string;
}

export interface QuickPick {
  key: string;
  food_name: string;
  meal_type: MealType;
  quantity: number | null;
  portion_unit: string | null;
  weight_grams: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  ingredients: string[];
  tags: string[];
  times_logged: number;
  last_logged: string | null;
}

export interface LastPerformance {
  exercise_name: string;
  date: string;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  rpe: number | string | null;
  sets_json: SetEntry[] | null;
  suggestion: { weight_kg: number | null; reps: string | number | null; message: string } | null;
}

export interface TodayMeal {
  meal_type: MealType;
  label: string;
  typical_time: string | null;
  logged: boolean;
  suggested_preset: Preset | null;
  top_picks: QuickPick[];
}

export interface TodayPlan {
  date: string;
  weekday: string;
  is_rest_day: boolean;
  checkin_done: boolean;
  weight_logged: boolean;
  workout: { split: Split | null; preset: Preset | null; logged: boolean; message: string };
  meals: TodayMeal[];
  protein: { eaten: number; target: number | null };
  calories: { eaten: number; target: number | null };
  next_action: { kind: "checkin" | "meal" | "workout" | "scoop" | "done"; label: string; meal_type: MealType | null };
}

// ---------------------------------------------------------------- History & assistant (docs/API.md)

export type HistoryStatus = "critical" | "warning" | "ok";
export type HistorySort = "date" | "calories" | "protein" | "deficit" | "weight" | "exercise";

export interface HistoryRow {
  date: string;
  day_number: number;
  weekday: string;
  is_today: boolean;
  is_rest_day: boolean;
  complete: boolean;
  morning_weight: number | null;
  weight_change: number | null;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  protein_per_kg: number | null;
  estimated_exercise_calories: number;
  estimated_tdee: number | null;
  calorie_deficit: number | null;
  deficit_status: "ok" | "pending";
  food_count: number;
  foods_preview: string[];
  workout: {
    splits: string[];
    lifting_min: number | null;
    cardio_min: number | null;
    exercise_count: number;
    exercises_preview: string[];
  };
  energy_level: number | null;
  sleep_hours: number | null;
  mood: number | null;
  bloating_status: BloatingStatus | null;
  steps: number | null;
  status: HistoryStatus;
  alerts_count: number;
  top_alert: string | null;
}

export interface HistorySummary {
  days: number;
  food_days: number;
  trained_days: number;
  avg_calories: number | null;
  avg_protein: number | null;
  avg_deficit: number | null;
  weigh_ins: number;
  weight_change: number | null;
  series: { date: string; calories: number | null; protein: number | null; deficit: number | null; weight: number | null }[];
}

export interface HistoryPage {
  items: HistoryRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  range: { start: string; end: string };
  summary: HistorySummary;
}

export interface HistoryFilters {
  q: string;
  start: string;
  end: string;
  workout: "any" | "trained" | "rest";
  split: Split | "";
  balance: "any" | "deficit" | "surplus" | "pending";
  status: "any" | HistoryStatus;
  weighed: "" | "true" | "false";
  sort: HistorySort;
  order: "asc" | "desc";
  page: number;
  page_size: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatAnswer {
  answer: string;
  mode: "ai" | "offline";
  provider: string | null;
  model: string | null;
  basis: string;
  asked_dates: string[];
  suggestions: string[];
  notice?: string;
  conversation_id?: string;
  question_id?: number;
  answer_id?: number;
}

export interface Conversation {
  id: string;
  title: string;
  started_at: string;
  updated_at: string;
  messages: number;
}

export interface StoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  meta: Partial<Omit<ChatAnswer, "answer">>;
  created_at: string;
}

// ---------- Data portability (Excel import, JSON backup / restore) ----------
export interface ImportRowError {
  sheet: string;
  row: number;
  error: string;
}

export interface ExcelImportResult {
  imported: { food: number; workouts: number; weights: number };
  created: { food: number; workouts: number };
  skipped: number;
  errors: ImportRowError[];
  dates: string[];
}

export interface BackupPreview {
  kind: "full" | "legacy";
  mode: "replace" | "merge";
  created_at: string | null;
  schema_revision?: string | null;
  counts: Record<string, number>;
  total: number;
  ignored_tables?: string[];
}

export interface RestoreResult {
  mode: "replace" | "merge";
  restored: Record<string, number>;
  total: number;
  safety_backup?: string;
  dates?: string[];
}

export interface SafetyBackup {
  name: string;
  size: number;
  /** Unix seconds. */
  created_at: number;
}

// ---------- Dashboard daily brief ----------
export type BriefTone = "start" | "great" | "good" | "mixed" | "off";

export interface DailyBriefNumbers {
  eaten_kcal: number | null;
  /** Today's intake goal: today's estimated burn minus ~600 kcal. */
  goal_kcal: number | null;
  kcal_left: number | null;
  protein_g: number | null;
  protein_target_g: number | null;
  protein_left_g: number | null;
  burned_kcal: number | null;
  exercise_kcal: number;
  balance_kcal: number | null;
  food_count: number;
  has_workout: boolean;
}

export interface DailyBrief {
  date: string;
  headline: string;
  good: string[];
  watch: string[];
  next: string[];
  tone: BriefTone;
  numbers: DailyBriefNumbers;
  /** "provider/model" or "rules". */
  source: string;
  generated_at: string;
  /** true when served from the stored brief (logs unchanged since it was written). */
  cached: boolean;
}
