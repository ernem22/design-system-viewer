# UI inceleme sırası (pipeline)

**Hedef yüzey:** `app/` — React + TS + Vite migration (design-system-viewer'ın
Preview + Compare + Tokens yüzeyleri).
**Mod:** Operate (araç; ziyaretçi bir işi tamamlar). İfade değil kesinlik
hedeflenir; bilinen desenler meşrudur. Marka ayrıntıda yaşar.
**Amaç:** Her açıdan iyileştirme ve hata tespiti (read-only teşhis). Düzeltme bu
sıranın kapsamı dışındadır; `findings.md` çıktıdır.

Not: `PRODUCT.md`/`DESIGN.md` yok. Tespit bloke edilmez, en sonda `init`
önerilir (SCOPED_EXISTING_ALLOWED).

## Sıra

| # | Faz | Komut/rol | Ne yapar | Çıktı |
|---|---|---|---|---|
| 0 | Bağlam | `impeccable context` | Proje, hedef, platform, incumbent sistem | RESOLVED_CONTEXT |
| 1a | Tarama — tasarım | `critique` (Assessment A) | Özgüllük, hiyerarşi, İA, bilişsel yük, duygusal yolculuk, 10 Nielsen heuristiği | Heuristic skor + P0-P3 |
| 1b | Tarama — teknik | `audit` (+bundled `detect`) | a11y, perf, theming, responsive, implementation integrity | 0-20 skor + P0-P3 |
| 2 | Kanıt — render | dev server + `detect` (URL) + screenshot | Render edilmiş görünüm, pixel kontrast, gerçek etkileşim | Görsel/console kanıtı |
| 3 | Sentez | triyaj | İki ekseni birleştir, örtüşme/false-positive ayır, önceliklendir | `docs/ui-review/findings.md` |
| 4 | Öneri (opsiyonel, sonra) | `init` → hedefli komutlar | Bağlamı yakala; bulgu tipine göre düzelt | — |

## Kapsam matrisi (her açı)

| Açı | Birincil kaynak |
|---|---|
| Tasarım özgüllüğü, hiyerarşi, İA, duygusal yol | `critique` A |
| Bilişsel yük, Nielsen 10 heuristiği | `critique` A |
| Erişilebilirlik (WCAG AA, klavye, kontrast, motion) | `audit` #1 |
| Performans (layout thrash, anim, bundle, re-render) | `audit` #2 |
| Theming / token drift | `audit` #3 |
| Responsive / touch / overflow | `audit` #4 |
| Implementation integrity (drift, slop, dekoratif içerik) | `audit` #5 + `detect` |
| İçerik / kopya / etiket / hata metni | `critique` A + `clarify` (öneri) |
| Durumlar / edge case / i18n | `critique` A + `harden` (öneri) |

## app/ bağlam kuralları (inceleme kısıtları)

- **Shell kontratı:** chrome asla hareket etmez, ekran başına tam bir scroll
  konteyneri (`.app-main`). Layout konteynerlerinde `overflow: hidden` yasak
  (`overflow: clip` kullan). `shell/shellContract.test.ts` ile zorlanır.
- **Dark mode emekli** (ürün kararı 2026-09-23): dark-mode bulgusu kusur
  değildir; eklenmez/düzeltilmez.
- Stil: co-located düz CSS, `dsv-*` (gallery) / `app-*` (shell) önekleri,
  token'lar çıplak `var(--token)` (fallback yok). CSS modules/Tailwind yok.
- State: Context/Redux/Zustand yok; hook + localStorage, `App.tsx`'e lift.
- Test/lint: `npm test` (vitest), `npm run lint` (eslint, app/ içinden).

## Yürütme kaydı

- 0 tamam: `NO_PRODUCT_MD`, incumbent implementasyon var, platform null,
  repo kökü `D:\code\design-system-viewer`.
- `detect app/src` → 3 advisory `bounce-easing` bulgusu (status.css:74,
  tokens.css:475, tokens.css:476). Bloklayıcı değil.
