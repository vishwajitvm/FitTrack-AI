"""All ORM models. Importing this package registers every table on `Base.metadata`."""
from app.models.ai import AIModel, AIProvider, AppSetting, LLMCallLog
from app.models.assistant import AssistantMessage
from app.models.daily import DailyBrief, DailySummary
from app.models.food import FoodAnalysis, FoodLibraryItem, FoodLog, MealMemory, PortionCalibration
from app.models.health import Biomarker, BioFeedback, MedicalReport
from app.models.preset import Preset
from app.models.user import User
from app.models.workout import WorkoutLog, WorkoutSession

__all__ = [
    "AIModel",
    "AIProvider",
    "AppSetting",
    "AssistantMessage",
    "Biomarker",
    "BioFeedback",
    "DailyBrief",
    "DailySummary",
    "FoodAnalysis",
    "FoodLibraryItem",
    "FoodLog",
    "LLMCallLog",
    "MealMemory",
    "MedicalReport",
    "PortionCalibration",
    "Preset",
    "User",
    "WorkoutLog",
    "WorkoutSession",
]
