import { formatDateTime, TYPE_LABEL, VERDICT_LABEL, type ScanRecord } from "./scan-record";

/** Builds a branded PDF report from a stored scan record. Runs in the browser only. */
export async function buildReportPdf(r: ScanRecord): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16, CW = W - M * 2;
  let y = 0;
  const navy: [number, number, number] = [7, 17, 31];
  const blue: [number, number, number] = [37, 99, 235];
  const cyan: [number, number, number] = [34, 211, 238];
  const ink: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];

  const ensure = (h: number) => { if (y + h > 280) { doc.addPage(); y = M; } };
  const heading = (t: string) => {
    ensure(14); y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...blue);
    doc.text(t.toUpperCase(), M, y); y += 2;
    doc.setDrawColor(...cyan); doc.setLineWidth(0.4); doc.line(M, y, M + 18, y); y += 6;
  };
  const para = (t: string, color = ink, size = 10) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(t, CW) as string[];
    lines.forEach((l) => { ensure(6); doc.text(l, M, y); y += 5; });
  };
  const bullets = (items: string[]) => items.forEach((t) => {
    const lines = doc.splitTextToSize(t, CW - 6) as string[];
    ensure(lines.length * 5 + 1);
    doc.setFillColor(...cyan); doc.circle(M + 1.2, y - 1.3, 0.9, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...ink);
    lines.forEach((l) => { doc.text(l, M + 5, y); y += 5; });
    y += 1;
  });

  // Header band
  doc.setFillColor(...navy); doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(...blue); doc.rect(0, 34, W, 1.2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(255, 255, 255);
  doc.text("TRUTHGUARD", M, 16);
  doc.setTextColor(...cyan); doc.text("AI", M + doc.getTextWidth("TRUTHGUARD "), 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(180, 200, 225);
  doc.text("Don't Believe Everything You See. Verify Before You Share.", M, 23);
  doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text("Analysis Report", W - M, 16, { align: "right" });
  doc.setTextColor(...cyan); doc.text(r.id, W - M, 23, { align: "right" });
  y = 46;

  // Meta table
  const rows: [string, string][] = [
    ["Scan ID", r.id],
    ["Analysis type", TYPE_LABEL[r.type]],
    [r.type === "url" ? "URL" : "File", r.target],
    ["Analysis date", formatDateTime(r.createdAt)],
    ["Detection result", VERDICT_LABEL[r.verdict]],
    ["Confidence", r.confidence === null ? "Not reported" : `${r.confidence}%`],
    ...(r.score !== null ? [[r.scoreLabel, r.scoreLabel === "Suspicious frames" ? String(r.score) : `${r.score}/100`] as [string, string]] : []),
  ];
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
  rows.forEach(([k, v]) => {
    const lines = doc.splitTextToSize(v, CW - 50) as string[];
    const h = Math.max(8, lines.length * 5 + 3);
    ensure(h);
    doc.setFillColor(241, 245, 249); doc.rect(M, y, 46, h, "F");
    doc.rect(M, y, CW, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...muted); doc.text(k, M + 3, y + 5.3);
    const isVerdict = k === "Detection result";
    const vc: [number, number, number] = isVerdict ? (r.verdict === "authentic" ? [22, 163, 74] : r.verdict === "fake" ? [220, 38, 38] : [37, 99, 235]) : ink;
    doc.setFont("helvetica", isVerdict ? "bold" : "normal"); doc.setFontSize(10); doc.setTextColor(...vc);
    lines.forEach((l, i) => doc.text(l, M + 50, y + 5.3 + i * 5));
    y += h;
  });

  heading("Detection summary"); para(r.summary || "No summary was provided.");
  heading("Technical findings"); bullets(r.findings.length ? r.findings : ["No technical findings were reported."]);
  heading("Suspicious indicators");
  if (!r.indicators.length) para("No suspicious indicators were reported.", muted);
  else bullets(r.indicators.map((i) => `${i.label}${i.severity ? ` [${i.severity.toUpperCase()}]` : ""}${i.description ? ` — ${i.description}` : ""}`));
  heading("Security recommendations"); bullets(r.recommendations);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text(`TRUTHGUARD AI · ${r.id}`, M, 290);
    doc.text(`Page ${p} of ${pages}`, W - M, 290, { align: "right" });
  }
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
