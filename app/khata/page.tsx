import type { Metadata } from "next";
import KhataApp from "@/components/khata/KhataApp";

export const metadata: Metadata = {
  title: "खाता · Pakka",
};

export default function KhataPage() {
  return <KhataApp />;
}
