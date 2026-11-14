# Implementation tickets (özet, öncelikli)

Kaynak: `review-log.md` (29 parti, 216 eleman). Bunlar uygulanacak işler; her ticket
bir implement geçişi + test/lint/build doğrulaması ile kapanır. Ayrıntı ve tüm
P3'ler `review-log.md`'de.

## P1 — gerçek hatalar (önce)

- **T01** Rename dialogunda input ref her render'da `select()` → tek karakter yazılabiliyor. `systems/SystemMenu.tsx:110-112`
- **T02** Sol rail grup chevron'u `data-state` almıyor → hiç dönmüyor. `shell/RailGroup.tsx:67-79`, `shell/shell.css:686`
- **T03** Avatar başharfleri 8 chart dolgusunun 4'ünde AA altı (beyaz sabit). Kontrast-güvenli on-chart eşleşmesi. `gallery/components/screens/screenBits.tsx:29-32`
- **T04** `Field` hint/error `aria-describedby` ile bağlı değil; `Field` invalid yönetmiyor. `gallery/ui.tsx:75-91` + tüm Field çağıranlar
- **T05** Token satırında çift tık 3 kez kopyalıyor. `tokens/rows.tsx:70-74`
- **T06** Token satırı selected/focus ring ~1.99:1 (accent-border), paylaşılan ring token'ı değil. `tokens/rows.css:86,424`
- **T07** Missing-token metni AA altı (`--color-warning`). `tokens/TokenGroup.css:80-85`
- **T08** Inline edit input'unun adı yok; ValueEditor'da Escape kaydediyor. `gallery/components/patterns.tsx:228`, `gallery/tokenInspector.tsx:138-171`
- **T09** Token-count badge adı yalnız sayı; 761-900px bandında tıklayınca hiçbir şey olmuyor. `gallery/tokenInspector.tsx:561,566`
- **T10** Add-system: Merge hataları hiç render olmuyor; "Replace it" onaysız/geri dönüşsüz; Merge'de System name ölü. `systems/AddSystemDialog.tsx:968,954,936`
- **T11** "Fill missing template" yapıştırılan CSS'i onaysız siliyor. `tokens/TokenDialog.tsx:92-98`
- **T12** Diff'te "missing" exclusive tür → gerçek farkları gizliyor. `compare/DiffTable.tsx:139-149`
- **T13** ErrorBoundary tüm chrome'u sarıyor + retry re-throw döngüsü + ham mesaj sızıyor. `shell/ErrorBoundary.tsx:38`, `App.tsx:604`
- **T14** Compare'da gallery-section seçenekleri (Forms/Validation/Login/Table/Team) id çakıştırıyor (prefix yok). `gallery/components/**`
- **T15** Compare kolonu `overflow:hidden` + eksik tokenlar aktif sistemin :root değerini miras alıyor. `compare/CompareColumn.tsx:49`, `compare/compare.css:65`

## P2 — gruplu

- **T16 Focus ringleri**: `.dsv-btn`, form atomları, nav, `.tok-btn`, `.app-pill`, compare segmented — `--focus-ring-*` token'ı. (`gallery.css`, `forms.css`, `navigation.css`, `TokenToolbar.css`, `shell.css`, `compare.css`)
- **T17 Form atomları a11y**: disabled opacity yerine token; radio grup adı; slider değer bağı; counter gerçek; textarea invalid. (`forms.css`, `forms.tsx`, `gallery.css`)
- **T18 Overlays**: Popover/Mega adsız dialog; per-column input id prefix; "Sign out" trash; kısayol aria; checked satır girintisi. (`overlays.tsx`)
- **T19 Toast**: hata assertive+atomic, `-text` renkleri, kalıcı+kapatma, ham exception yerine kopya. (`Toasts.tsx`, `Toasts.css`, `toasts.ts`, `App.tsx`)
- **T20 Welcome/Drop/SharedBanner**: ".json" copy, scrim, type floor, kart focus/press, banner role=status, "N dropped" jargon, sticky. (`Welcome.*`, `SharedSystemBanner.*`)
- **T21 Tokens toolbar/dialog**: roving `defaultPrevented`, focus restore, search-cancel çift, `.tok-btn` ring, scrim, dil birliği, boş CTA disable. (`TokenToolbar.*`, `TokenDialog.tsx`)
- **T22 Tokens rows/props**: listbox adı+roving, "Light"=inverse etiketi, shadow taşması, ResizeObserver, chrome type floor, coverage rounding, Cancel/Escape. (`rows.*`, `TokensProps.*`, `InlineEditor.*`, `TokenGroup.css`)
- **T23 Compare rail/props**: arama sırasında static header, `?cmp` sanitize, pick sırası, kaldırınca focus, coverage a11y, fiil birliği. (`CompareRail.tsx`, `CompareProps.tsx`, `useCompareView.ts`)
- **T24 Screens**: sayfa gutter'ı, login/signup/onboarding form+validate, settings state, checkout form, search facet modeli, command palette combobox, upload dropzone, pricing switch adı, marketing CTA specificity. (`screens/*`)
- **T25 Add-system**: dirty guard, dialog açıkken page drop, type floor/focus, write-mode radiogroup. (`AddSystemDialog.*`, `SchemaFill.*`)
- **T26 Durum bileşenleri**: empty state `role=status`, banner dismiss focus, spinner/skeleton/progress semantiği, progress `transform`. (`status.*`, `feedback.*`)

## P3 — cila
`review-log.md`'deki P3 satırları (literal→token, kopya birliği, küçük görsel/odak düzeltmeleri).

## Durum (controller loop)
- P1 T01�T15: **DONE** (testler ye�il, 648/648, lint temiz).
- S�radaki: P2 T16�T26.

## Durum (controller loop) � SON
- P1 T01�T15: DONE
- P2 T16�T26: DONE (baz� kapsam notlar� agent raporlar�nda; roving-focus/perf refactor bilin�li ertelendi)
- Do�rulama: 655 test / 93 dosya ge�ti, lint temiz, build temiz, render detect 13 (regresyon yok).
- P3 cila: kalan (review-log.md P3 sat�rlar�).
- Commit edilmedi (kullan�c� onay� bekliyor).
