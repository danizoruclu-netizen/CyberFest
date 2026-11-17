import { toast } from "sonner";
import type { ScanRecord } from "./scan-record";
import { saveScan } from "./scan-store";

/** Saves a computed result (live or local) to history and reports the outcome. */
export function persist(make: () => ScanRecord) {
  try {
    const r = make();
    saveScan(r);
    toast.success("Saved to Scan History", { description: `Report ${r.id} is ready to view.` });
  } catch {
    toast.error("Couldn't save this scan to history", { description: "Your browser storage may be full or turned off." });
  }
}
