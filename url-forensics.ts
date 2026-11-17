/**
 * Local URL checks: structural / string-level signals only. No HTTP request is
 * made, so domain age, reputation and redirect chains are explicitly reported
 * as unavailable instead of being guessed.
 */
import type { UrlAnalysisResult, UrlFinding } from "@/lib/url/url-analysis";
import { clamp, scoreSignals, type ForensicSignal } from "./forensics-shared";

const BRANDS = [
  "google", "facebook", "instagram", "microsoft", "apple", "paypal", "amazon", "netflix",
  "whatsapp", "telegram", "twitter", "linkedin", "ebay", "icloud", "github", "youtube",
  "discord", "spotify", "binance", "coinbase", "dropbox", "adobe", "bank", "gov",
];

const ABUSED_TLDS = new Set(["tk", "ml", "ga", "cf", "gq", "top", "xyz", "click", "loan", "work", "bid", "stream", "download"]);
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "buff.ly", "cutt.ly", "rebrand.ly"]);

function distance(a: string, b: string) {
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((cur[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j] ?? 0;
  }
  return prev[b.length] ?? 0;
}

const finding = (s: ForensicSignal): UrlFinding => ({
  label: s.label,
  description: s.description,
  severity: s.severity,
});

export function inspectUrl(rawInput: string, normalizedUrl: string, hostname: string): UrlAnalysisResult {
  let parsed: URL;
  try { parsed = new URL(normalizedUrl); } catch { parsed = new URL(`https://${hostname}`); }
  const host = hostname.toLowerCase();
  const labels = host.replace(/^www\./, "").split(".").filter(Boolean);
  const label = labels.length > 1 ? (labels[labels.length - 2] ?? "") : (labels[0] ?? "");
  const tld = labels[labels.length - 1] ?? "";
  const lower = normalizedUrl.toLowerCase();
  const signals: ForensicSignal[] = [];

  // Non-ASCII / punycode homograph risk is checked on the user's original text.
  if (/[^\x00-\x7f]/.test(rawInput) || host.startsWith("xn--")) {
    signals.push({ label: "Internationalised / encoded domain", description: "The domain contains non-Latin or punycode characters. Lookalike domains can use Cyrillic or Greek letters that resemble Latin ones.", severity: "high", impact: "negative" });
  }
  if (parsed.username || parsed.password || rawInput.includes("@")) {
    signals.push({ label: "Credentials in URL", description: "An @ symbol can hide the real destination: the part before it is only user info.", severity: "high", impact: "negative" });
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    signals.push({ label: "Bare IP address", description: "The link points directly to an IP address instead of a named domain — common in phishing campaigns.", severity: "high", impact: "negative" });
  }

  const parts = label.split("-").filter(Boolean);
  const lookalike = BRANDS.find((brand) =>
    parts.some((part) => part !== brand && distance(part, brand) <= (brand.length > 6 ? 2 : 1)),
  );
  if (lookalike) {
    signals.push({ label: `Possible lookalike of ${lookalike}`, description: `"${label}" contains a part very close to the brand "${lookalike}" but not identical to it. Check the spelling carefully.`, severity: "high", impact: "negative" });
  } else if (BRANDS.some((brand) => host.includes(`${brand}-`) || host.includes(`-${brand}`))) {
    signals.push({ label: "Brand name combined with extra words", description: "Well-known brand names next to hyphens are frequently used to imitate official sites.", severity: "medium", impact: "negative" });
  }

  if (parsed.protocol === "http:") {
    signals.push({ label: "Unencrypted connection", description: "The link uses HTTP, not HTTPS. Any data you enter can be intercepted.", severity: "medium", impact: "negative" });
  } else {
    signals.push({ label: "HTTPS connection", description: "The link uses HTTPS (presence of a lock does not guarantee the site is legitimate).", severity: "low", impact: "positive" });
  }

  if (parsed.port && !["80", "443", ""].includes(parsed.port)) {
    signals.push({ label: "Unusual port", description: `The URL uses port ${parsed.port}; legitimate public sites normally use 80/443.`, severity: "medium", impact: "negative" });
  }
  if (SHORTENERS.has(host)) {
    signals.push({ label: "URL shortener", description: "Short links hide the final destination. Expand it before signing in anywhere.", severity: "medium", impact: "negative" });
  }
  if (ABUSED_TLDS.has(tld)) {
    signals.push({ label: "Frequently abused top-level domain", description: `.${tld} domains are cheap and often used for short-lived phishing sites.`, severity: "medium", impact: "negative" });
  }
  if (/(login|verify|secure|account|update|confirm|password|signin|billing|claim|urgent|limited)/.test(lower)) {
    signals.push({ label: "Credential or urgency wording", description: "Words like login, verify, secure or urgent are common in phishing links.", severity: "medium", impact: "negative" });
  }
  if ((host.match(/-/g) ?? []).length >= 2) {
    signals.push({ label: "Many hyphens in domain", description: "Hyphen-heavy domains are often used to mimic a trusted brand.", severity: "low", impact: "negative" });
  }
  if (/\d/.test(label)) {
    signals.push({ label: "Digits in domain name", description: "Numbers replacing letters (e.g. 0 for O, 1 for l) are a common typosquatting trick.", severity: "low", impact: "negative" });
  }
  if (normalizedUrl.length > 120) {
    signals.push({ label: "Long URL", description: `This address is ${normalizedUrl.length} characters long; long links are often used to hide the real path.`, severity: "low", impact: "negative" });
  }
  if (lower.includes("%2f") || lower.includes("//", 8)) {
    signals.push({ label: "Obfuscated path", description: "Encoded slashes or doubled slashes in the path can confuse link parsers.", severity: "low", impact: "negative" });
  }

  const phishing = signals.filter((s) => s.impact === "negative" && s.severity !== "low").map(finding);
  const warnings: UrlFinding[] = [
    { label: "Offline check only", description: "No network request was made. Domain age, registrar, country reputation and the redirect chain cannot be verified locally.", severity: "low" },
    ...signals.map(finding),
  ];

  const trustScore = Math.round(clamp(scoreSignals(signals, 88), 8, 96));
  const risk = trustScore >= 70 ? "low" : trustScore >= 40 ? "medium" : "high";
  const summary = [
    `${signals.length} URL properties measured. ${phishing.length} raised more than a low-level concern.`,
    ...signals.map((s) => `• ${s.label}: ${s.description}`),
  ].join("\n");

  return {
    trustScore,
    risk,
    phishingIndicators: phishing,
    warnings,
    domain: {
      name: host,
      registrar: null,
      ageDays: null,
      country: /^[a-z]{2}$/.test(tld) ? tld.toUpperCase() : null,
      https: parsed.protocol === "https:",
    },
    redirects: [],
    summary,
  };
}
