import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantView } from "@/components/assistant/assistant-view";

export const metadata: Metadata = { title: "Ask FitTrack" };

export default function AskPage() {
  return (
    <Suspense>
      <AssistantView />
    </Suspense>
  );
}
