import { formatTimestamp, type SuspiciousFrame, type TimelineSegment } from "@/lib/video/video-analysis";

const tone = (s: number) => (s >= 60 ? "bg-destructive" : s >= 30 ? "bg-primary" : "bg-success/70");

/** Frame-by-frame suspicion bar with markers at suspicious timestamps. */
export function FrameTimeline({ duration, timeline, frames }: { duration: number | null; timeline: TimelineSegment[]; frames: SuspiciousFrame[] }) {
  const total = duration ?? Math.max(1, ...timeline.map((t) => t.end), ...frames.map((f) => f.timestamp));
  if (timeline.length === 0 && frames.length === 0)
    return <p className="text-sm text-muted-foreground">The service didn't return a frame timeline.</p>;
  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-lg border border-glass-border bg-background/60">
        {timeline.map((seg, i) => (
          <div
            key={i}
            title={`${formatTimestamp(seg.start)}–${formatTimestamp(seg.end)} · ${seg.score}% suspicious`}
            className={`absolute inset-y-0 ${tone(seg.score)}`}
            style={{ left: `${(seg.start / total) * 100}%`, width: `${((seg.end - seg.start) / total) * 100}%`, opacity: 0.25 + seg.score / 140 }}
          />
        ))}
        {frames.map((f, i) => (
          <span
            key={i}
            title={`${formatTimestamp(f.timestamp)} · ${f.score}%`}
            className="absolute inset-y-0 w-0.5 bg-cyan shadow-glow"
            style={{ left: `${(f.timestamp / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>0:00</span>
        <span>{formatTimestamp(total)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-success/70" /> Low</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" /> Medium</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-destructive" /> High</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-0.5 bg-cyan" /> Suspicious frame</span>
      </div>
    </div>
  );
}
