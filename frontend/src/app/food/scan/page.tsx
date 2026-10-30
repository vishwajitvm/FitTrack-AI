import type { Metadata } from "next";
import { ScanView } from "@/components/scan/scan-view";

export const metadata: Metadata = { title: "Snap a meal" };

export default function ScanPage() {
  return <ScanView />;
}
