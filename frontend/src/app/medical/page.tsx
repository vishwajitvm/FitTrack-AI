import type { Metadata } from "next";
import { MedicalView } from "@/components/medical/medical-view";

export const metadata: Metadata = { title: "Medical reports" };

export default function MedicalPage() {
  return <MedicalView />;
}
