"use client";

/** Last resort when the app shell itself fails: plain markup, no app styles or providers. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0b0b14", color: "#e5e7eb", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>FitTrack hit a problem</h1>
          <p style={{ fontSize: 14, opacity: 0.8 }}>Your data is safe. Reload to continue.</p>
          {error.message && <p style={{ fontSize: 12, opacity: 0.6, fontFamily: "monospace", wordBreak: "break-word" }}>{error.message}</p>}
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: 0, background: "#7c3aed", color: "white", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
