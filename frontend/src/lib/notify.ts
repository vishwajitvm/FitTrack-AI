// Central place for toasts (sonner) and confirmations (sweetalert2).
import Swal from "sweetalert2";
import { toast } from "sonner";
import { api } from "./api";
import { friendlyError } from "./errors";
import type { EntryIds } from "./types";

export const notify = {
  success: (msg: string, description?: string) => toast.success(msg, { description }),
  /** Friendly "what happened + what to do"; `context` names the action that failed (e.g. "Could not save"). */
  error: (err: unknown, context?: string) => {
    const f = friendlyError(err, context);
    return toast.error(f.title === "Something went wrong" && context ? context : f.title, { description: f.message });
  },
  info: (msg: string, description?: string) => toast.info(msg, { description }),
  warning: (msg: string, description?: string) => toast.warning(msg, { description }),
};

/**
 * Success toast with an "Undo" button (one-tap actions). `undo` runs the reversal;
 * `onUndone` refreshes data afterwards.
 */
export function notifyUndo(message: string, description: string | undefined, undo: () => Promise<unknown>, onUndone?: () => void) {
  toast.success(message, {
    description,
    duration: 10000,
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await undo();
          toast.info("Undone", { description: "Removed again." });
          onUndone?.();
        } catch (err) {
          notify.error(err, "Could not undo");
        }
      },
    },
  });
}

/** Undo for anything created through presets / copy / quick picks. */
export function undoEntries(ids: EntryIds) {
  return api.post("/api/entries/delete", ids);
}

interface ConfirmOptions {
  title: string;
  text?: string;
  confirmText?: string;
  danger?: boolean;
}

export async function confirmAction({ title, text, confirmText = "Yes, continue", danger = false }: ConfirmOptions) {
  const result = await Swal.fire({
    title,
    text,
    icon: danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    reverseButtons: true,
    focusCancel: danger,
    customClass: danger ? { confirmButton: "swal-danger" } : undefined,
  });
  return result.isConfirmed;
}

export function confirmDelete(what: string, text?: string) {
  return confirmAction({
    title: `Delete ${what}?`,
    text: text ?? "This cannot be undone.",
    confirmText: "Delete",
    danger: true,
  });
}

/** Ask for a short text (e.g. a preset name). Resolves to null when cancelled. */
export async function askText(title: string, opts: { label?: string; value?: string; placeholder?: string; confirmText?: string } = {}) {
  const result = await Swal.fire({
    title,
    input: "text",
    inputLabel: opts.label,
    inputValue: opts.value ?? "",
    inputPlaceholder: opts.placeholder,
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Save",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    inputValidator: (v) => (!v.trim() ? "Please enter a name" : v.length > 80 ? "Keep it under 80 characters" : undefined),
  });
  return result.isConfirmed ? String(result.value).trim() : null;
}

/** Run a mutation with a success toast, or an error toast on failure (returns undefined then). */
export async function withToast<T>(fn: () => Promise<T>, success: string, errorTitle?: string): Promise<T | undefined> {
  try {
    const res = await fn();
    notify.success(success);
    return res;
  } catch (err) {
    notify.error(err, errorTitle);
    return undefined;
  }
}

/** Show a long block of text (e.g. AI output) in a modal. */
export function showText(title: string, text: string) {
  const el = document.createElement("div");
  el.style.whiteSpace = "pre-wrap";
  el.style.textAlign = "left";
  el.textContent = text;
  return Swal.fire({ title, html: el, width: 720, confirmButtonText: "Close" });
}
