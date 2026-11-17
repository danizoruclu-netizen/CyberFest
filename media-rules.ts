/**
 * Upload rules for the Deepfake Detection module.
 * Pure functions so they can be tested and reused by other pages.
 */
export type MediaKind = "image" | "video";

export const MB = 1024 * 1024;

export const MEDIA_RULES: Record<
  MediaKind,
  { extensions: string[]; mimeTypes: string[]; maxBytes: number; label: string }
> = {
  image: {
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 20 * MB,
    label: "Images up to 20 MB",
  },
  video: {
    extensions: ["mp4", "mov"],
    mimeTypes: ["video/mp4", "video/quicktime"],
    maxBytes: 200 * MB,
    label: "Videos up to 200 MB",
  },
};

export const SUPPORTED_FORMATS = ["JPG", "JPEG", "PNG", "WEBP", "MP4", "MOV"];

/** Value for the file input's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = [
  ...MEDIA_RULES.image.extensions.map((e) => `.${e}`),
  ...MEDIA_RULES.video.extensions.map((e) => `.${e}`),
  ...MEDIA_RULES.image.mimeTypes,
  ...MEDIA_RULES.video.mimeTypes,
].join(",");

export type MediaValidation =
  | { ok: true; kind: MediaKind }
  | { ok: false; error: string };

type FileLike = { name: string; type: string; size: number };

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function validateMediaFile(file: FileLike): MediaValidation {
  const ext = extensionOf(file.name);
  const kind = (Object.keys(MEDIA_RULES) as MediaKind[]).find((k) =>
    MEDIA_RULES[k].extensions.includes(ext),
  );

  if (!kind) {
    return {
      ok: false,
      error: `Unsupported file type${ext ? ` (.${ext})` : ""}. Please upload ${SUPPORTED_FORMATS.join(", ")}.`,
    };
  }

  const rule = MEDIA_RULES[kind];
  // Browsers sometimes leave the type empty; when present it must match the extension.
  if (file.type && !rule.mimeTypes.includes(file.type.toLowerCase())) {
    return {
      ok: false,
      error: `This file says it is .${ext} but its contents look like "${file.type}". Please upload a genuine ${SUPPORTED_FORMATS.join(", ")} file.`,
    };
  }

  if (file.size <= 0) {
    return { ok: false, error: "This file is empty. Please choose another one." };
  }

  if (file.size > rule.maxBytes) {
    return {
      ok: false,
      error: `This ${kind} is ${formatBytes(file.size)}. The limit is ${formatBytes(rule.maxBytes)} for ${kind}s.`,
    };
  }

  return { ok: true, kind };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}
