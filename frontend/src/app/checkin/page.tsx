import type { Metadata } from "next";
import { CheckInView } from "@/components/checkin/checkin-view";

export const metadata: Metadata = { title: "Check-in & gut health" };

export default function CheckInPage() {
  return <CheckInView />;
}
