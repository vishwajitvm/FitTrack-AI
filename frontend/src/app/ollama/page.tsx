import type { Metadata } from "next";
import { OllamaView } from "@/components/ollama/ollama-view";

export const metadata: Metadata = { title: "Ollama" };

export default function OllamaPage() {
  return <OllamaView />;
}
