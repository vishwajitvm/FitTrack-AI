# Meal photo analysis

Code: `backend/app/services/nutrition/analyzer.py`, `portions.py`, `search.py`.
Diagram: [`diagram/food-photo-analysis.mmd`](diagram/food-photo-analysis.mmd)

## Inputs (all optional except a photo **or** a description)

| Field | Why it helps |
|---|---|
| Photo | The vision model identifies items, cooking style, hidden oil |
| Description / ingredients | Removes guesswork ("tadka with peanuts", "2 tsp ghee") |
| Container preset or size (ml) / plate diameter (cm) | Gives a physical scale |
| Fill level (quarter → heaped) | Turns container volume into food volume |
| Known weight (g) | Overrides every estimate — item weights are scaled to sum to it |
| Servings / portion eaten | Scales the whole analysis |
| Cooking method / oil used | Tightens fat estimates and the upper calorie bound |

## Weight estimation

1. **Geometry**: `container volume × fill fraction × bulk density`. Plates use `π r² × 1.5 cm`. Densities (g/ml): cooked rice 0.70, pasta 0.60, dal/curry 1.0, dry sabzi 0.60, salad 0.30, drinks ~1.02.
   Example: large steel tiffin 750 ml × half full × 0.70 = **≈ 262 g** of fried rice.
2. **Vision model** estimates grams per item using visual cues and the geometry hint.
3. **Reconcile**: known weight wins; otherwise if vision and geometry differ by > 40%, their average is used and a warning is shown.

## Nutrition grounding

For every item, per-100 g values come from (first good match wins):

1. Built-in library — 86 common Indian and global foods (IFCT/USDA composite), fuzzy-matched with pgvector trigram embeddings
2. USDA FoodData Central (Foundation, SR Legacy, FNDDS)
3. Open Food Facts (packaged foods)
4. Tavily web search snippets (sources only)

Final macros blend the database value (70% for strong matches, 50% otherwise) with the AI's estimate, so cooking oil the AI saw is not lost.

## Ranges & confidence

- `calories_low = weight_low × kcal/g × 0.95`
- `calories_high = weight_high × kcal/g × 1.05` (+45 kcal if fried and no oil amount was given)
- Confidence = average of AI and database confidence (+0.05 when verified); unverified items are reduced by 15%.

The result is stored in `food_analyses`; nothing goes into your food log until you review and press **Save**.
