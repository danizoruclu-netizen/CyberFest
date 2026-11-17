import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { VERDICT_LABEL, type ScanVerdict } from "@/lib/history/scan-record";

const MAP = {
  authentic: { tone: "success", icon: ShieldCheck },
  suspicious: { tone: "pending", icon: ShieldQuestion },
  fake: { tone: "danger", icon: ShieldAlert },
} as const;

export function VerdictBadge({ verdict }: { verdict: ScanVerdict }) {
  const m = MAP[verdict];
  return <StatusBadge tone={m.tone}><m.icon className="h-3 w-3" /> {VERDICT_LABEL[verdict]}</StatusBadge>;
}
