# UI inceleme bulguları — `app/`

**Hedef:** `app/` (React 19 + TS + Vite migration; Tokens + Preview + Compare).
**Mod:** Operate. **Tarih:** 2026-11-12. **Kapsam:** read-only teşhis.
**Sıra:** `pipeline.md` (Faz 0 context → 1a critique → 1b audit → 2 render → 3 sentez).

Okuma kılavuzu: Faz 1a ve 1b bağımsız yürütüldü (birbirini görmedi). Faz 2 render
kanıtıdır. En sonda **birleşik öncelik backlog'u** var; satırlar `P?` ile sıralı.

---

## Faz 1a — Tasarım/UX critique (Assessment A)

Kaynak: subagent, kaynak-okuma (tarayıcı yok). **Heuristic toplam: 28/40 (Good, %70).**

**Design specificity verdict:** Yüksek özgüllük — kategori-değiştirilebilir değil.
rail→content→props üçlüsü, sayısal rampalar, WCAG kontrast bölümü, per-kolon
`var()` çözen token diff ve her demoda token-sayısı badge'i başka bir ürüne
taşınamaz. Chrome kasıtlı olarak token-nötr (incelenen sistem üzerinden render
edilir) — bir viewer için doğru karar. Tek gerilim: nötr ≠ ölçülü; chrome tipi ve
geometrisi tamamen incelenen sisteme bağlı (aşağıda P1).

### Heuristic skorlar

| Heuristic | Skor | Not |
|---|---|---|
| Visibility of System Status | 4 | Aktif tab/rail + kayan gösterge, coverage ring, `aria-live`, toast'lar |
| Match System ↔ Real World | 3 | "schema", "coverage", "ramp", "ref", "54 groups" yer yer terim sızıntısı |
| User Control & Freedom | 3 | Her yerde iptal/Esc; silme/yeniden-adlandırmada undo yok (`SystemMenu.tsx:143`) |
| Consistency & Standards | 3 | Compare'da "picked/unpick" vs "selected"; iki farklı arama etiketi |
| Error Prevention | 3 | Stepper/kollision/zero-schema kapıları iyi; rename'de kollision kontrolü yok |
| Recognition Rather Than Recall | 2 | Kopyala/çift-tık-düzenle yalnız hover `title`'da (`rows.tsx:69`) |
| Flexibility & Efficiency | 2 | Tab/arama kısayolu yok, command palette yok, 432+ tab stop |
| Aesthetic & Minimalist | 3 | Ölçülü; Add dialog ve topbar kümesi gürültülü istisnalar |
| Error Recovery | 3 | İnline `role=alert`; ama ErrorBoundary ham `error.message` sızdırır (`:49`) |
| Help & Documentation | 2 | Help dialog güncel değil, çekirdek etkileşimi atlıyor |

### Öncelikli bulgular (1a)

- **[P1] Chrome tipi ve geometrisi tamamen incelenen sisteme bağlı.**
  `shell/shell.css:26` (`font-size: var(--font-size-base)`), `:611` (rail etiketleri
  `--font-size-xs`), `:100`. Kompakt/hatalı bir sistem — seed'in kendisi
  `--font-size-xs: 11px` veriyor (`systems/store.ts:114`) — viewer'ın kendi
  chrome'unu okunamaz küçük render eder. Motion için çözüm deseni zaten var
  (`tokens/tokens.css:451-464` `--app-*`); tip/geometri için de `--app-font-size-*`
  / `--app-control-*` (veya min clamp) ekle.
- **[P1] Çekirdek token etkileşimi keşfedilemez ve yarı-fare.**
  `tokens/rows.tsx:69` "tıkla-kopyala — çift-tık-düzenle"yi yalnız hover `title`'da
  tutar; `:75` Enter/Space'i yalnız kopyalamaya bağlar → satır düzeyinde klavye ile
  düzenleme yolu yok. Hover/focus'ta görünür kopyala+düzenle affordance'ı ve
  belgelenmiş klavye yolu ekle.
- **[P2] Help dialog eski modeli öğretiyor.** `shell/HelpDialog.tsx:64` hâlâ
  "only differences toggle" diyor; kontrol artık üç-yollu "Show" segmented
  (`compare/DiffTable.tsx:161-176`). Ayrıca copy-on-click / double-click-to-edit /
  token-badge kontratına hiç değinmiyor.
- **[P2] Compare tek kavram için iki fiil.** `compare/CompareRail.tsx:86-87`
  "picked/unpick", `compare/CompareView.tsx:32` + `CompareProps.tsx:16` "selected".
  Tek fiilde standartlaştır ("select").
- **[P2] Token galerisi klavye tab tuzağı.** Her satır `role=option` + `tabIndex=0`,
  `role=listbox` içinde roving focus yok (`rows.tsx:68,91`; `ColorGrid :119`,
  `ColorRamp :259`, `TypeRow :447`, `SchemaView :82`). 432-token sistem yüzlerce
  sıralı tab stop açar ve ARIA listbox desenini bozar. Toolbar'daki mevcut ok
  mantığıyla (`TokenToolbar.tsx:43-69`) roving tabindex + Arrow/Home/End ekle.

### Persona red flag'leri

- **Alex (deneyimli/güçlü):** Tab ve odaklı-arama kısayolu yok, command palette yok,
  toplu işlem yok; temiz paste bile Continue→Continue→Save. Add dialog'da yüksek
  terk riski.
- **Jordan (ilk kez):** Topbar ikon-only; her biri hover `title`'a bağlı. Kopyala/
  düzenle kontratı görünmez. "coverage/schema/WCAG AA" açıklamasız.
- **Sam (erişilebilirlik-bağımlı):** `SchemaView.tsx:66-82` `role=grid` içinde
  `<td>` (role cell, gridcell değil) + satırlarda `tabIndex` — uyumsuz ARIA deseni.
  Satırdan klavye ile düzenleme yok. Focus ring incelenen sistemin
  `--color-focus-ring`ine bağlı (`shell.css:49`) → düşük kontrastlı sistem focus'u
  gizleyebilir.

### Küçük gözlemler (1a)

- `preview/PreviewSystems.tsx:17` ölü üretim kodu (yalnız testlerde yaşıyor).
- `shell/ErrorBoundary.tsx:49` ham `error.message` + jenerik toast (`:31`).
- `CompareView.tsx:37,56` ve `DiffTable.tsx:205,239` inline `style` padding.
- Literal `letter-spacing: 0.08em` (`shell.css:614`), literal `border-radius: 6px`
  (`:618`) — token sisteminden sapma.
- `SystemMenu.tsx:74` `Export CSS<code>:root stylesheet</code>` — ayırıcı boşluk yok
  (görsel doğrulama gerek).
- Üç farklı arama affordance'ı: "Search components…" / "Filter tokens…" /
  "Filter systems".
- Sistem değişince Tokens filtresi/seçimi sessizce sıfırlanır (`useTokensView.ts:125-133`).

---

## Faz 1b — Teknik audit

Kaynak: subagent. **Audit sağlık skoru: 17/20 (Good).** `detect` exit 0 (3 advisory),
`npm run lint` PASS, `npm test` FAIL (flaky, aşağıda).

### Skor tablosu

| # | Boyut | Skor | Ana bulgu |
|---|---|---|---|
| 1 | Accessibility | 3 | Genel güçlü; rail indicator/chevron reduced-motion dışı; canlı cross-system kontrast doğrulanamadı |
| 2 | Performance | 3 | `will-change` yok, panel girişi compositor-only; ama `.app-rail-indicator` `top`/`height` animasyonu |
| 3 | Theming | 4 | 3-katmanlı token sistemi; `tokens.css` dışında **sıfır** hex/rgb literal |
| 4 | Responsive | 3 | Breakpoint/overlay/container-query var; chrome hedefleri kendi 44px token'ının altında |
| 5 | Implementation Integrity | 4 | `detect` temiz (3 advisory doğrulandı kasıtlı); drift yok |

**Implementation Integrity verdict: PASS.** Tutarlı, ürüne-özgü bir sistem.

### Bulgular (1b)

- **[P2] Rail indicator ve chevron `prefers-reduced-motion`'ı yok sayıyor.**
  `shell/shell.css:718-729` (indicator `transition: top/height`), `:634-638`
  (chevron `transform 200ms`); reduced-motion bloğu yalnız `:568-578`
  (`.app-rail-inner`/`.app-props-inner`). `motion284.test.ts` ve
  `reducedMotion.test.ts` bu seçicileri kapsamıyor. WCAG 2.2 SC 2.3.3 (AAA).
  → `$impeccable animate`
- **[P2] Rail indicator layout özellikleri animasyonluyor (`top`/`height`).**
  `shell/shell.css:726-728`. #282 geri kalanı transform/opacity'ye indirmişken bu
  straggler. Compositor-only `transform: translateY()` (+sabit yükseklik) kullan.
  → `$impeccable optimize`
- **[P2] Tam test koşusu flaky.** `SchemaView.test.tsx:75,85`,
  `tokensA11y221.test.tsx:129`. `npm test`: 2 dosya / 3 test timeout (5000ms),
  618/621; izolasyonda aynı 2 dosya 11/11 PASS. Runner 90 worker (~6.53s startup)
  açıyor. `isolate:false`/worker cap + `IS_REACT_ACT_ENVIRONMENT` ayarla.
  → `$impeccable harden`
- **[P3] Chrome touch hedefleri kendi 44px token'ının altında.**
  `.app-iconbtn` 28×28 (`shell.css:351-363`), topbar-search 24×24 (`:316-331`),
  tabs ~20px (`:398-410`), `--touch-target-min: 44px` (`tokens.css:513`).
  WCAG SC 2.5.8 (AA, 24px) **karşılanıyor**; SC 2.5.5 (AAA, 44px) hayır. Token↔uygulama
  iç tutarsızlığı. → `$impeccable adapt`
- **[P3] 11px altı işlevsel metin.** `%` glifi 9px (`TokensProps.css:80-84`),
  "EDITED" 10px (`tokenInspector.css:121-127`). → `$impeccable typeset`
- **[P3] Eski easing token'ları / modal spring.** `tokens.css:475-476`,
  `--motion-modal` `--ease-spring` (`:487`, tüketici `gallery.css:179`).
  `--ease-bounce` belgelenmiş/demolanmış token → koru; modal için `--ease-emphasized`
  düşün. → `$impeccable polish`
- **[P3] Demo specimen'leri paint/layout özellikleri animasyonluyor.**
  `feedback.css:6` (`transition: width`), `gallery.css:560-562` (`box-shadow`),
  `screens.css:24-26,86-91`. Düşük frekanslı ama desen kopyalanabilir.
  → `$impeccable polish`

### Sistemik desenler (1b)

- **Token disiplini sistemik ve zorlanmış:** `tokens.css` dışında literal renk yok;
  `gallery/contrast.test.ts:201-205` bunu test ediyor.
- **Reduced-motion galeri animasyon seti için tam, fakat roving shell transition'ları
  için yok** — boşluk transition-tabanlı chrome hareketine sistemik.
- **Layout-animasyon kalıntısı:** rail indicator bir politika straggler'ı.
- **`--breakpoint-*` token'ları pratikte ölü** (`tokens.css:502-507`): her `@media`
  literal (1080/900/720/600/480), `var()` media query'de desteklenmiyor.

### Araç sonuçları (1b)

| Araç | Sonuç |
|---|---|
| `impeccable detect --json app/src` | exit 0; 3 advisory `bounce-easing` — **üçü de token tanımı/specimen → kusur değil** |
| `npm test` (vitest) | **FAIL** exit 1: 2 dosya / 3 test timeout; 618/621; izolasyonda PASS → worker çekişmesi |
| `npm run lint` (eslint) | **PASS** exit 0 |
| `app/tools/contrast-sweep.js` | Çalıştırılamadı (tarayıcı gerektirir); yerine statik kontrast testleri geçti |

Doğrulanamayan: canlı cross-system piksel kontrastı, gerçek 320/390/768/1280 layout,
touch/gesture davranışı (tarayıcı/emülatör gerekir).

---

## Faz 2 — Rendered kanıt (dev server + URL taraması)

`npm run dev` (port 5199) → `impeccable detect` URL taraması.
**Masaüstü 1280×800: 14 bulgu. Mobil 390×844: 13 bulgu.**

| Antipattern | Adet | Önem | Not |
|---|---|---|---|
| low-contrast | 6 | 4 warning / 2 advisory | Aşağıya bakın |
| wide-tracking | 1 | warning | `letter-spacing: 0.08em` gövde metninde (letter-spacing specimen) |
| skipped-heading | 1 | warning | `<h1> "Design System Viewer"` → `<h3> "Color12"` (h2 atlanmış) |
| dark-glow | 1 | warning | Zero-offset glow `#6366f1` |
| radial-halo | 1 | warning | `radial-gradient(#0ea5e9 → transparent)` |
| repeating-stripes-gradient | 1 | advisory | Dekoratif tekrar-gradyan şeritler |
| bounce-easing | 1 | advisory | `cubic-bezier(0.34,1.56,0.64,1)` (easing specimen) |
| em-dash-overuse | 1 | advisory | Gövdede 44 em-dash |
| straggler | 1 | advisory | Yalnız masaüstünde (`p.tok-props-empty` "here.") |

**low-contrast kırılımı (chrome'da, incelenen sistem token'larından):**
- `input.tok-filter` placeholder "Filter tokens…" 3.6:1 (#777870 / #20211f)
- `.tok-contrast-badge.yes` 3.4:1, `.tok-contrast-badge.mid` 3.7:1
- `.tok-contrast-chip` 4.2:1 ve 3.8:1 (contrast demo örnekleri)

**Değerlendirme / false-positive ayıklaması:**
- low-contrast bulguları app chrome'unun *incelenen sisteme göre* renklenmesinin
  sonucudur — Faz 1a P1 (chrome'un sisteme bağımlılığı) ile **aynı kök nedeni**
  paylaşır. Statik kod audit'i bunu göremez; render taraması açığa çıkardı.
- `dark-glow` / `radial-halo` / `repeating-stripes-gradient`: pazarlama *demo
  ekranının* parçası (`screens.css:52-80`, `--glow-md` / `.dsv-hero-grid` /
  `.dsv-hero-orb`) — ürün chrome'u değil, galeri artifact'ı. **App kusuru değil**;
  demo görsel kalitesi açısından bilinçli karar. (1b'de de böyle işaretlendi.)
- `wide-tracking` / `bounce-easing`: token *specimen*'leri (ürünün işi bunları
  göstermek). Aksiyon önerilmez.
- `skipped-heading`: **gerçek** — galeri bölüm başlıkları `h3`
  (`tokenInspector.tsx:294`, `gallery/ui.tsx:112`), h1'den sonra h2 yok. `App.test.tsx`
  outline'ı (#117) kilitlemiş ama bu atlamayı engellemiyor.
- `straggler` / `em-dash-overuse`: küçük kopya/dizgi cila, P3.

Sunucu kapatıldı.

---

## Birleşik öncelik backlog'u (sıralı)

İki eksen + render birleştirildi; örtüşenler tek satırda. Her satırda önerilen komut.

### P1
1. **[1a]** Chrome tipi/geometrisi incelenen sisteme bağımlı → chrome okunamaz küçülür
   (`shell.css:26,100,611`; `systems/store.ts:114`). `--app-*` tip/kontrol katmanı ekle.
   → `$impeccable typeset` (+ `layout`)
2. **[1a]** Token satırı etkileşimi keşfedilemez + klavyeyle düzenleme yolu yok
   (`tokens/rows.tsx:69,75`). Görünür affordance + klavye yolu. → `$impeccable clarify` + `layout`

### P2
3. **[1b]** Rail indicator + chevron reduced-motion dışı (`shell.css:718-729,634-638`).
   → `$impeccable animate`
4. **[1b]** Rail indicator layout (`top`/`height`) animasyonluyor (`shell.css:726-728`).
   → `$impeccable optimize`
5. **[1a]** Token galerisi klavye tab tuzağı / kırık listbox roving focus
   (`rows.tsx:68,91`; `SchemaView.tsx:66-82`). → `$impeccable adapt` (+ a11y)
6. **[1a]** Help dialog eski modeli öğretiyor (`HelpDialog.tsx:64`). → `$impeccable clarify`
7. **[1a]** Compare'da "picked/unpick" ↔ "selected" tutarsızlığı
   (`CompareRail.tsx:86-87` vs `CompareView.tsx:32`). → `$impeccable clarify`
8. **[1b]** Test koşusu flaky (worker contention) (`npm test` 618/621).
   → `$impeccable harden`

### P3
9. **[render]** `skipped-heading`: h1→h3 atlaması → bölüm başlıklarını h2 yap.
   → `$impeccable adapt`
10. **[1b]** Chrome touch hedefleri < 44px token (`shell.css:351-363` vb.).
    → `$impeccable adapt`
11. **[1b]** 9px/10px işlevsel mikro-metin (`TokensProps.css:80-84`,
    `tokenInspector.css:121-127`). → `$impeccable typeset`
12. **[1b]** Eski easing token'ları / modal spring (`tokens.css:475-487`).
    → `$impeccable polish`
13. **[1b]** Demo specimen'leri `width`/`box-shadow` animasyonluyor
    (`feedback.css:6` vb.). → `$impeccable polish`
14. **[1a]** Küçük cila: ölü `PreviewSystems.tsx`, ErrorBoundary sızıntısı, inline
    padding'ler, literal letterspacing/radius, SystemMenu boşluğu, 3 arama etiketi,
    sistem değişiminde sessiz filtre sıfırlama. → `$impeccable polish` / `distill`

### Öneri
- `npm test` flaky olduğu için CI sinyali zayıf (bkz. P2-8) — önce onu stabilize etmek
  sonraki tüm düzeltmelerin güvenilirliğini artırır.
- `PRODUCT.md`/`DESIGN.md` yok: bu tespit bloğu tamamlandı; bağlamı kalıcı kılmak için
  **`$impeccable init`** (ardından `document`) önerilir.

---

## Yöntem ve sınırlar

- **İzolasyon:** 1a (tasarım) ve 1b (teknik) bağımsız subagent'lar olarak, birbirini
  görmeden çalıştı. 1b deterministik `detect` + `npm test`/`lint` kanıtı kullandı.
- **Render:** dev server + URL taraması (masaüstü/mobil). Gerçek gesture/touch ve
  ~40 sistemin canlı piksel kontrastı doğrulanamadı (tarayıcı/emülatör gerekir).
- **False-positive'ler ayıklandı:** token tanımları/specimen'leri ve pazarlama demo
  glow/halo'ları app kusuru sayılmadı.
- **Dark mode** ürün kararı gereği kusur olarak işaretlenmedi.
- Kaynak referans: `docs/ui-review/pipeline.md`.
