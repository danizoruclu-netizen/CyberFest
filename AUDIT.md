# TRUTHGUARD AI — Texniki Audit Hesabatı

**Tarix:** 2026-11-17
**Auditçı:** 15 illik frontend/security təcrübəsi baxışı
**Layihə:** TanStack Start + React 19 + Tailwind 4 + TypeScript (Lovable skafoldu)
**Status:** Demo Mode tam interaktiv hala gətirildi; 60/60 test, tip yoxlaması və production build təmiz keçdi.

---

## 1. İcra xülasəsi

Giriş anında tətbiq **vizual olaraq hazır, funksional olaraq isə "placeholder" idi**: backend qoşulmadığı üçün bütün analiz düymələri ya passiv idi, ya da "Demo Mode — no analysis was performed" deyirdi. Fayl yüklənir, amma heç nə ölçülmürdü.

**Bu sessiyada edilən:** Real, ölçüm əsaslı **client-side forensik analiz qatı** əlavə olundu. Artıq hər modul işləyir:

| Modul | Əvvəl | İndi |
|---|---|---|
| Deepfake (şəkil) | heç nə | JPEG/PNG/WebP bayt və EXIF analizi + piksel statistikası (createImageBitmap + canvas), TruthScore |
| Video | heç nə | `<video>` ilə 5–12 kadr örnekləmə, kadr fərqi/donma/səs-küy sıçrayışı, konteyner imzası (lavf/FFmpeg), timeline |
| URL | heç nə | 15+ struktur heuristikası: punycode, lookalike domen (Levenshtein), HTTP, abus edilən TLD, IP, @-obfuscation |
| Fake News | tamamilə disabled | mətn heuristikaları: clickbait, ALL CAPS, nida, emosiya, mənbə/attribut, rəqəmli iddia |
| Full Verification | tamamilə disabled | media + mətn birləşdirilmiş hesabat |
| Tarixçə | boş | bütün nəticələr localStorage-a yazılır, `source: "live" | "local"` ilə |

**Əsas prinsip qorundu:** heç bir dəyər uydurulmur. Hər score ölçülmüş xüsusiyyətlərdən deterministik hesablanır və UI açıqca *"Local forensic result — not a trained detector"* deyir.

---

## 2. Kritik tapıntılar və həll yolları

### 2.1 ⚠️ ƏN VACİB: Brendinq və etibar problemi (həll edildi, amma izlənməli)
**Tapıntı:** "TRUTHGUARD AI", "AI MEDIA VERIFICATION", "TruthScore" adları, "confidence 71%" kimi rəqəmlər istifadəçidə *ML modeli işləyir* təəssüratı yaradırdı. Halbuki heç bir model yox idi. Bu, məhsulun ən böyük reputasiya və hüquqi riskidir (yanlış "fake" etiketi insanlara zərər verə bilər).

**Edilən:** hər nəticənin üzərində sarı xəbərdarlıq, "Local analysis" badge, `modelVersion: "local-forensics-v1"`, izahatda metod və məhdudiyyətlər.

**Tövsiyə (yüksək prioritet):**
- Brendinqdən "AI" sözünü çıxarın və ya **yalnız real model qoşulduqda** göstərin. `SystemStatusCard` və dashboard "How it works" artıq "Local analysis" deyir — qalan yerləri də yoxlayın.
- TruthScore üçün rəng kodlamasını (yaşıl/sarı/qırmızı) yalnız "risk göstəricisi" kimi izah edin, "həqiqilik dərəcəsi" kimi yox.
- Hüquqi disclaimer + "Report an error" əlaqəsi əlavə edin.

### 2.2 Backend yoxdur (qalan əsas funksional boşluq)
**Tapıntı:** `VITE_TRUTHGUARD_API_URL` qoşulmayıb. Lokal analiz güclü olsa da, **əsl deepfake aşkarlama (FaceForensics++, EfficientNet-B4/ViT, frequency-domain artefaktlar, lip-sync)** yalnız serverdə/GPU-da mümkündür.

**Həll yolu:**
```bash
# backend contract (artıq kodda hazırdır):
POST /analyze/image   multipart "file"  → { truthScore, authenticityStatus, suspiciousIndicators, confidence, ... }
POST /analyze/video   multipart "file", mode=frames
POST /analyze/url     JSON { url }
```
- FastAPI + PyTorch +ONNX Runtime, `uvicorn`, `/health` endpoint.
- `VITE_TRUTHGUARD_API_URL=https://api.example.com` təyin edildikdə avtomatik live rejimə keçir (`local-runner.ts` bu fallback-i artıq edir).
- CORS, rate limiting, 20/500 MB limitləri **server tərəfdə də** təkrar yoxlanmalı (client validation etibarlı deyil).

### 2.3 Məlumat saxlama və miqyaslanma
**Tapıntı:** `localStorage` (`truthguard.scans.v1`) istifadə olunur. 5 MB limit var; 500 MB-lıq videoların özü saxlanmır (yaxşı), amma çox sayda hesabat tez dolar. `persist.ts` xətanı toast ilə göstərir, amma istifadəçi məlumatı itirir.

**Həll:** IndexedDB (idb və ya Dexie) + eksport/import (JSON). Cloud üçün `scan-store.ts` interfeysi artıq ayrılıb — swap etmək asan.

### 2.4 URL analizində şəbəkə yoxlamasının olmaması
**Tapıntı:** Registrar, domen yaşı, real redirect zənciri, WHOIS, VirusTotal — hamısı `null`. Bu, məhsulun ən çox reklam edilən xüsusiyyətlərindən biridir.

**Həll:** server tərəfdə `whois`/RDAP + DNS + TLS + redirect fetch (`HEAD`/`GET`, sandbox, SSRF qoruması!). **SSRF kritik təhlükəsizlik riskidir** — istifadəçi daxil etdiyi URL ilə daxili şəbəkəyə (`169.254.169.254`, `127.0.0.1`) giriş cəhdləri bloklanmalıdır.

---

## 3. Yüksək prioritet tapıntılar

### 3.1 Test örtüyü (ən çox 60 test, əksəriyyəti parsers)
- ✅ Yeni lokal analizatorlar üçün 7 test əlavə edildi.
- ❌ **Komponent/UX testləri yoxdur** (yalnız 2 routing testi). Playwright e2e əlavə edin: yüklə → analiz et → nəticə → tarixçə → PDF.
- ❌ Image/video forensik funksiyaları jsdom-da test edilə bilməz (canvas yox). Bunun üçün browser e2e və ya `canvas` package lazımdır.
- ❌ Accessibility testləri (axe-core) yoxdur.

### 3.2 Xəta idarəetməsi
- `local-runner.ts` backend xətasını **sessizcə** lokal analizə keçirir. İstifadəçi "server niyə işləmədi?" bilmir. `notice` sahəsi əlavə edildi, amma bunu toast və ya kiçik "Niyə lokal?" linki ilə də göstərin.
- Video analizində `seeked` timeout 5 saniyə — böyük fayllarda yetərli olmaya bilər. Progress + retry əlavə edin.
- `delay()` və `AnalysisCancelled` AbortSignal ilə düzgün işləyir, amma **"Cancel" düyməsi local analiz zamanı** `AnalysisProgress`-də görünür — yoxlanıldı, işləyir.

### 3.3 Təhlükəsizlik
- EXIF/XMP mətnləri birbaşa `text-foreground` kimi render olunur. React default olaraq escape edir (təhlükəsizdir), amma **PDF generasiyasında** (`jspdf` + `html2canvas`) istifadəçi məzmunu keçərsə HTML injection riski var — `report-pdf.ts` kodunu audit edin, `text()` ilə `html()` fərqinə diqqət.
- `DOMPurify` build-də görünür (yaxşı), amma harada istifadə olunduğunu yoxlayın.
- File type validation yalnız extension + MIME-ə əsaslanır. **Magic-byte yoxlaması** artıq image-forensics-də var (JPEG/PNG/WebP), amma `validateMediaFile` səviyyəsində deyil — oraya da əlavə edin.

### 3.4 Performans
- `analyzePixels` hər 12x12 blok üçün `ctx.getImageData` çağırır — 384×384 şəkil üçün ~1000 çağırış. Bir dəfə `getImageData` alıb blokları ordan hesablamaq ~10× sürətləndirər.
- `inspectVideo` hər kadr üçün yeni `<canvas>` yaradır — reuse edin.
- `jspdf`, `html2canvas`, `canvg` (~1 MB gzip) yalnız PDF düyməsinə basıldıqda lazy-load edilməlidir (`dynamic import`). Hazırda main bundle-a daxildir.
- Fontlar "Sora", "Manrope", "JetBrains Mono" — `@import` yoxdur, sistem fontuna düşür. Ya fontları ekspress yükləyin, ya da `font-display: swap` ilə local hosting.

### 3.5 Accessibility (a11y)
- `MediaDropzone` drag-and-drop div-i `role="button"` və keyboard ilə işləyir ✅.
- `StatusBadge` rəng + mətn istifadə edir ✅.
- ❌ `TruthScoreRing` SVG-sinə `role="img"` + `aria-label` lazımdır.
- ❌ Analiz nəticəsi gəldikdə ekran oxuyucuya xəbər verən `aria-live="polite"` region yoxdur (report header-i belə etməyin).
- ❌ Toaster (sonner) mesajları vizual yaxşı, amma focus trap / escape dokumentasiyası yoxdur.

### 3.6 Kod keyfiyyəti
- `AGENTS.md` qaydalarına əməl edildi: bütün rənglər `styles.css` tokenlarında, bütün shared UI `components/common`-da, nav yalnız `nav-items.ts`-də.
- ❌ `DemoModeBanner.tsx`, `DemoNotice.tsx` (DemoNotice hissən), `ResultsPlaceholder.tsx`, `UploadZone.tsx` artıq istifadə olunmur — ya silin, ya da yeni lokal rejimə uyğunlaşdır. Ölü kod texniki borcdur.
- ❌ `unreachable` state-i bəzi route-larda qaldı (deepfake/video/url-də təmizləndi) — grep ilə yoxlayın.
- ❌ `exactOptionalPropertyTypes: true` ilə işləyərkən bəzi yerlərdə `notice ? { notice } : {}` spread-i istifadə edildi — düzgündür, amma oxunaqlılıq üçün `notice: string | null` daha sadə olar.

---

## 4. Orta və aşağı prioritet

| # | Tapıntı | Təsir | Həll |
|---|---|---|---|
| 4.1 | Dashboard "Recent activity" hələ **saxta demo məlumat** (`DEMO_ACTIVITY`) göstərir | Etibar | `DashboardStats`/`RecentActivity` real `useScans()` ilə işləyir; demo cədvəli silin və ya `source="demo"` ilə açıq etiketlənsin |
| 4.2 | `npm install` npm 9 ilə `overrides` səbəbindən partlayır | Developer UX | README-də `pnpm install` yazın (bun.lock da var) və ya npm 10+ tələb edin |
| 4.3 | Deprecated paketlər: `recharts`, `eslint`, `@testing-library/jest-dom` | Texniki borc | major upgrade planı, testlərlə qorunaraq |
| 4.4 | Mobil (`MobileTabBar`) 8 elementi necə göstərir? | UX | 5+ element olduqda "More" menyusu və ya scrollable tab bar |
| 4.5 | `robots.txt` və favicon var ✅, amma OG image yox | SEO | `public/og-image.png` əlavə edib meta `og:image` |
| 4.6 | PDF hesabatda "Live result" yazısı qala bilər | Etibar | `report-pdf.ts`-də `source` sahəsini göstərin (report səhifəsində artıq düzəldildi) |
| 4.7 | EXIF parser minimaldır | Analiz keyfiyyəti | `exifr` kitabxanası ilə Genel ifd, GPS, MakerNote; XMP-ni `DOMParser` ilə oxuyun |
| 4.8 | İmkan vermir: şəkil üçün "error level analysis" (ELA) | Analiz keyfiyyəti | Canvas-da yenidən JPEG-ə kodlayıb fərq görüntüsü yarat; serverdə daha etibarlı |

---

## 5. Bu sessiyada dəyişdirilən fayllar (qeyd üçün)

**Yeni lokal analiz qatı:**
- `src/lib/local/forensics-shared.ts`
- `src/lib/local/image-forensics.ts`
- `src/lib/local/video-forensics.ts`
- `src/lib/local/url-forensics.ts`
- `src/lib/local/text-forensics.ts`
- `src/lib/local/local-runner.ts`
- `src/lib/local/__tests__/local-forensics.test.ts`
- `src/components/common/LocalModeNotice.tsx`

**Yenilənən:**
- `src/routes/deepfake.tsx`, `video.tsx`, `url.tsx`, `fake-news.tsx`, `verify.tsx`, `history.tsx`, `report.$scanId.tsx`, `index.tsx`
- `src/components/common/MediaAnalysisReport.tsx`, `AnalysisProgress.tsx`
- `src/components/layout/SystemStatusCard.tsx`
- `src/lib/deepfake/api.ts` (AnalysisPhase genişləndirildi)
- `src/lib/history/scan-record.ts` (`source` sahəsi), `persist.ts`
- `src/test/navigation-routes.test.tsx` (8 nav elementi)

**Doğrulama:** `tsc --noEmit` ✅ · `pnpm test` 60/60 ✅ · `pnpm build` ✅ · Playwright ilə 5 modul + video real faylla ✅ · console xətası yox ✅

---

## 6. Tövsiyə olunan iş sırası (next sprint)

1. **Brendinq düzəlt** (AI iddiasını yumşalt, disclaimer) — 0.5 gün
2. **Backend contractunu qoş** (FastAPI + ONNX model, `/health`) — 3–5 gün
3. **SSRF qoruması + rate limit** — 1 gün
4. **Playwright e2e testləri** — 1 gün
5. **IndexedDB + JSON export** — 1 gün
6. **Lazy-load PDF** + piksel analizi optimallaşdırması — 0.5 gün
7. **axe-core a11y testləri və SVG aria-labels** — 0.5 gün
8. **Dashboard saxta activity məlumatlarını sil** — 0.25 gün
