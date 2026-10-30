import type { Metadata } from "next";
import { FoodLogView } from "@/components/food/food-log-view";

export const metadata: Metadata = { title: "Food log" };

export default function FoodPage() {
  return <FoodLogView />;
}
