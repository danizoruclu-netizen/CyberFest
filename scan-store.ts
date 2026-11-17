/**
 * Scan history storage. Currently saved in this browser (localStorage).
 * All reads/writes go through this module so it can be swapped for a
 * per-user cloud table later without touching pages.
 */
import { useEffect, useState } from "react";
import type { ScanRecord } from "./scan-record";

const KEY = "truthguard.scans.v1";
const EMPTY: ScanRecord[] = [];
let cache: ScanRecord[] | null = null;
const listeners = new Set<() => void>();

function read(): ScanRecord[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? (parsed as ScanRecord[]).filter((r) => r && typeof r.id === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: ScanRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(next));
  cache = next;
  listeners.forEach((l) => l());
}

export function saveScan(record: ScanRecord) {
  write([record, ...read().filter((r) => r.id !== record.id)]);
}

export function deleteScan(id: string) {
  write(read().filter((r) => r.id !== id));
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Returns null until the browser has mounted (then the stored history).
 * The mount gate keeps SSR/prerendered HTML and the first client render
 * identical, which avoids a hydration mismatch in static/SPA deployments.
 */
export function useScans(): ScanRecord[] | null {
  const [mounted, setMounted] = useState(false);
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    setMounted(true);
    return subscribe(() => forceUpdate((v) => v + 1));
  }, []);
  return mounted ? read() : null;
}

export const useScan = (id: string) => {
  const list = useScans();
  return list === null ? undefined : (list.find((r) => r.id === id) ?? null);
};

export { EMPTY as NO_SCANS };
