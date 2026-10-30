// One-line "What is this page?" texts shown under page titles in Simple mode.

export const PAGE_INTROS = {
  dashboard: "Your day at a glance: what you've eaten, what's left to do today, and how you're trending.",
  food: "Everything you ate today. Tap your usual foods to add them, type a meal in plain words, or snap a photo.",
  scan: "Take a photo of your plate — we estimate the calories and protein for you. Adding ingredients or the container size makes it more accurate.",
  workouts: "Log your training in a few taps: pick your routine, tick what you did, save. Charts and details are further down.",
  history: "Every day you logged, newest first. Search or filter, then tap a day to see what you ate, your workout, weight and how you felt.",
  ask: "Ask anything about your own data in plain words — “what did I eat last Monday?” or “at this rate, when will I reach my target?”. Answers use your real logs.",
  tracker: "One page per day with every number in one place. Use “Trends” to compare weeks.",
  checkin: "A 10-second morning check: how you slept and how you feel. It helps the app adjust your training and spot foods that upset your stomach.",
  insights: "Patterns the app learns from your own data: your real calorie burn, weight trend, training load and what gives you energy.",
  medical: "Got a blood test? Upload the PDF or a photo — we read the values for you and explain them in plain words. Optional, not a daily task.",
  profile: "Your basic details. Age, sex, height and weight are needed to calculate how many calories you burn.",
  ai: "Optional: connect a free AI service for better meal-photo analysis and coaching. Everything else works without it.",
  ollama: "Optional and for advanced users: run AI on your own computer, fully offline. Most people can skip this page.",
  settings: "Display options, your data (download / import) and on-device models.",
} as const;

export type PageKey = keyof typeof PAGE_INTROS;
