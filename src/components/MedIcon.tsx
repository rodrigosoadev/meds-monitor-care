import { Pill, Droplet, Syringe, Capsule, Tablets } from "lucide-react";
import type { MedIcon as MedIconType } from "@/lib/storage";

const MAP = {
  pill: Pill,
  capsule: Tablets,
  syrup: Droplet,
  injection: Syringe,
  drop: Droplet,
} as const;

export function MedIcon({ icon, className }: { icon: MedIconType; className?: string }) {
  const Cmp = (MAP as any)[icon] ?? Pill;
  return <Cmp className={className} />;
}
