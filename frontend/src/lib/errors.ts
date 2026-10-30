// Turns technical errors into "what happened + what to do" for people, keeping the raw text for details.
import { ApiError } from "./api";

export interface FriendlyError {
  title: string;
  message: string;
  technical: string;
}

const AI_RE = /provider|all providers failed|llm|model|rate.?limit|429|quota|ollama|api key|unauthori[sz]ed/i;

export function friendlyError(err: unknown, context?: string): FriendlyError {
  const technical = err instanceof Error ? err.message : String(err);
  const status = err instanceof ApiError ? err.status : -1;

  if (status === 0 || /failed to fetch|network|cannot reach/i.test(technical)) {
    return {
      title: "Can't reach FitTrack",
      message: "The app's server isn't answering. Make sure it's running (docker compose up), then try again.",
      technical,
    };
  }
  if (AI_RE.test(technical)) {
    return {
      title: "The AI service didn't answer",
      message: "All AI helpers are busy or not set up. Try again in a minute, use ML-only mode, or add a free Google Gemini key on the AI providers page.",
      technical,
    };
  }
  if (status === 404) {
    return { title: "Not found", message: "That item doesn't exist any more — it may have been deleted. Refresh the page.", technical };
  }
  if (status === 409) {
    return { title: "Already there", message: "That's already saved. Refresh to see the latest.", technical };
  }
  if (status === 413) {
    return { title: "File too big", message: "Use a smaller photo or PDF (under 15 MB).", technical };
  }
  if (status === 422 || status === 400) {
    return { title: "Some details need fixing", message: plainValidation(technical), technical };
  }
  if (status >= 500) {
    return { title: "Something went wrong on our side", message: "The server hit a problem. Try again in a moment — your other data is safe.", technical };
  }
  return { title: context ?? "Something went wrong", message: technical || "Please try again.", technical };
}

/** "weight_kg: Input should be greater than 0" → "Weight kg: should be greater than 0" */
function plainValidation(text: string): string {
  return text
    .split("; ")
    .map((part) => {
      const [field, ...rest] = part.split(": ");
      const msg = rest.join(": ").replace(/^Input /, "").replace(/^Value error, /, "");
      if (!msg) return part;
      const name = field.replace(/_/g, " ");
      return `${name.charAt(0).toUpperCase()}${name.slice(1)}: ${msg}`;
    })
    .join(" · ");
}
