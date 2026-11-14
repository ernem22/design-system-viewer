# HANDOFF — kompakt durum

## Ürün / hedef
- `app/` (React 19 + TS + Vite) "Design System Viewer" — Operate aracı. Legacy `preview/`, `src/viewer` kapsam dışı.
- Çalışma kökü: `D:\code\design-system-viewer`. Dev server: **http://localhost:5199/** (vite yalnız IPv6 `::1`; `localhost` kullan).
- URL-state: `?tab=tokens|preview|compare`, `?sys=<slug>`, `?q=`, `?cmp=a,b`.

## Ne yapıldı
1. **Commit `f25a388 "fix: impeccable"`** — sol rail yeniden tasarımı + ilk düzeltmeler:
   - Rail.tsx (satır=bölüm, roving focus, satır-başı aktif, sticky aile, arama rail'de), RailGroup.tsx, SectionSearch.tsx, lib/scrollspy.ts (tek landing offset, pin yok, offset cache), Shell.tsx, shell.css, gallery/registry.ts (Components/Extras/Screens), App.tsx, CompareRail/registry/compare.css, gallery.css, tokens.css; HelpDialog, chrome type floor, heading h2, vitest config.
   - Docs: `docs/design/rail-redesign/pipeline.md`, `docs/ui-review/{pipeline,findings}.md`.
2. **Commit'siz çalışma ağacı (92 dosya)** — 29-parti tarama sonrası T01–T26 düzeltmeleri (shell/chrome, gallery primitives, forms, overlays, tokens, compare, systems, 27 ekran, +4 yeni test).
   - Docs: `docs/ui-review/{inventory,review-log,tickets}.md`.

## Doğrulama durumu
- `npm test` 655/655 (93 dosya), `lint` temiz, `build` temiz.
- `detect` URL taraması 13 (regresyon yok) — ama **headless, etkileşimsiz**.

## AÇIK / eksik (önemli)
- **Gerçek tarayıcı etkileşim/layout testi YAPILMADI.** Birim testler happy-dom (layout motoru yok). Kullanıcı "görsel hata var" diyor.
- Sıradaki iş: Playwright ile 390/768/1280'de tab-tab, ekran-ekran screenshot + console hataları; görsel/etkileşim hatalarını çıkar ve düzelt.
- P3 cila hâlâ açık (`review-log.md`).

## Hızlı dosya haritası
- Shell/chrome: `app/src/shell/*`
- Galeri: `app/src/gallery/{gallery.css,ui.tsx,components/*,components/screens/*}`
- Tokens: `app/src/tokens/*`
- Compare: `app/src/compare/*`
- Systems: `app/src/systems/*`
- Test/lint/build: `app/` içinde `npm test|run lint|run build`.
