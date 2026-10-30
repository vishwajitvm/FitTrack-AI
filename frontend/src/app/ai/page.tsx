import type { Metadata } from "next";
import { AiView } from "@/components/ai/ai-view";

export const metadata: Metadata = { title: "AI providers & keys" };

export default function AiPage() {
  return <AiView />;
}
