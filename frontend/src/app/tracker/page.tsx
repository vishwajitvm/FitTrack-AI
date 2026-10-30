import type { Metadata } from "next";
import { TrackerView } from "@/components/tracker/tracker-view";

export const metadata: Metadata = { title: "Daily tracker" };

export default function TrackerPage() {
  return <TrackerView />;
}
