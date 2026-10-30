import type { Metadata } from "next";
import { WorkoutsView } from "@/components/workouts/workouts-view";

export const metadata: Metadata = { title: "Workouts" };

export default function WorkoutsPage() {
  return <WorkoutsView />;
}
