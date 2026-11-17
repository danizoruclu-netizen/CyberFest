import { useEffect, useRef, useState, type DragEvent } from "react";
import { FileImage, FileVideo, RefreshCw, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import {
  ACCEPT_ATTRIBUTE,
  MEDIA_RULES,
  SUPPORTED_FORMATS,
  formatBytes,
  type MediaKind,
} from "@/lib/deepfake/media-rules";

type Props = {
  file: File | null;
  kind: MediaKind | null;
  error: string | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
  /** Overrides for single-purpose pages (e.g. video only). */
  accept?: string;
  formats?: string[];
  limitsLabel?: string;
};

/** Drag-and-drop / click-to-browse picker with a live preview of the chosen image or video. */
export function MediaDropzone({ file, kind, error, disabled, onSelect, onClear, accept = ACCEPT_ATTRIBUTE, formats = SUPPORTED_FORMATS, limitsLabel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const openPicker = () => !disabled && inputRef.current?.click();

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onSelect(dropped);
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="sr-only"
      tabIndex={-1}
      aria-label="Choose an image or video"
      onChange={(e) => {
        const picked = e.target.files?.[0];
        if (picked) onSelect(picked);
        e.target.value = "";
      }}
    />
  );

  if (file && kind) {
    const Icon = kind === "image" ? FileImage : FileVideo;
    return (
      <div className="space-y-4">
        {input}
        <div className="relative overflow-hidden rounded-2xl border border-glass-border bg-background/60">
          <div className="flex aspect-video items-center justify-center">
            {previewUrl && !previewFailed ? (
              kind === "image" ? (
                <img
                  src={previewUrl}
                  alt={`Preview of ${file.name}`}
                  className="h-full w-full object-contain"
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <video
                  src={previewUrl}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-contain"
                  onError={() => setPreviewFailed(true)}
                />
              )
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 text-center text-muted-foreground">
                <Icon className="h-10 w-10 text-cyan" />
                <p className="text-sm">Preview isn't available in this browser, but the file can still be analysed.</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-glass-border bg-glass/60 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan/25 bg-primary/15 text-cyan">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground" title={file.name}>
                {file.name}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {formatBytes(file.size)} · {kind === "image" ? "Image" : "Video"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openPicker} disabled={disabled} className="flex-1 sm:flex-none">
              <RefreshCw className="h-4 w-4" /> Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear} disabled={disabled} aria-label="Remove file" className="flex-1 sm:flex-none">
              <X className="h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {input}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Upload an image or video. Drag and drop, or press Enter to browse."
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:py-16",
          dragging
            ? "border-cyan bg-primary/15 shadow-glow"
            : error
              ? "border-destructive/50 bg-destructive/5"
              : "border-glass-border bg-glass/40 hover:border-cyan/50 hover:bg-glass/70",
        )}
      >
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 animate-scan bg-gradient-to-b from-transparent via-cyan/10 to-transparent" />
        <div className="relative flex flex-col items-center">
          <div
            className={cn(
              "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan/30 bg-primary/20 text-cyan transition-transform",
              dragging ? "scale-110" : "animate-float",
            )}
          >
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold text-foreground">
            {dragging ? "Drop to upload" : "Drag & drop an image or video"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or <span className="font-semibold text-cyan underline-offset-4 group-hover:underline">browse your files</span>
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {formats.map((f) => (
              <StatusBadge key={f} tone="muted">
                {f}
              </StatusBadge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {limitsLabel ?? `${MEDIA_RULES.image.label} · ${MEDIA_RULES.video.label}`}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
