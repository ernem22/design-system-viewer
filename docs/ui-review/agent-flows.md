# Agent akışları — kalan işler

Kontrolcü: ana ajan (ben). Her akış bir subagent'a verilir; bitince **ben** tam test + lint +
build + (mümkünse) Playwright screenshot ile doğrularım. Akışlar dosya olarak büyük ölçüde
bağımsız; B `App.tsx`/`shell/*`, C `compare/*`, A `systems/ImportSheet*` + `tokens/*`.

Ortak kurallar (her agent okur):
- `C:\Users\zurza\.claude\skills\impeccable\reference\craft-floor.md` + `app/CLAUDE.md`.
- Operate aracı; shell kontratı (chrome hareket etmez, tek içerik scroller `.app-main`,
  layout konteynerlerinde `overflow: clip`); dark mode emekli; chrome token'ları
  `var(--token)`, chrome motion `--app-*`; sağ props rail mevcut; plain CSS.
- Testleri yalnız eski davranışı sabitlediğinde değiştir; değiştirdiklerini raporla.
- Kendi `npm run build` + `npm run lint` + ilgili `npx vitest run`'ı koş. **Tam suite'i çalıştırma** (kontrolcü yapar).

---

## FLOW A — Import sheet: "iyi"den "harika"ya (görsel + etkileşim cilası)
**Skiller:** `polish` (birincil) + `layout` + `clarify` + `typeset` + `adapt`; başlamadan
`critique.md`'nin Assessment A'sını hızlıca uygula (mevcut ekranı eleştir).
**Kapsam:** `app/src/systems/ImportSheet.tsx`, `ImportSheet.css`; yalnız *tüketim* için
`SchemaFill.*`, `tokens/CssPreview.*` (davranışlarını değiştirme).
**Sorun:** Şu an sakin ve doğru ama "harika" değil: paste alanı çok büyük/boş, canlı özet
şeridi dolu durumda zayıf, "Fill missing from schema" açılınca ekranı ele geçirebilir,
"Review changes" diff'i sade, boş/hatalı/kollision durumları yeterince rafine değil.
**Adımlar:**
1. `polish`: hiyerarşi, boşluk ritmi, tek primary, ikincillerin sessizliği; paste alanı
   yüksekliği (içerikle esnek, min/maks), autofocus ring'i, "Awaiting CSS block" boş durumu.
2. `layout`: dolu durumda canlı özet şeridi (N token · X/Y schema · W warnings) + warnings
   açılırı; "Fill missing from schema" açıldığında kompakt, kaydırılabilir, ekranı ele
   geçirmeyen bir bölüm (mevcut `SchemaFill`'i çerçevele).
3. `clarify` + `typeset`: kopya tutarlılığı (Save system / Add tokens / Review changes),
   etiketler, mono token isimleri.
4. `adapt`: ≤640px'te tek kolon, disclosure'lar önce kapanır, footer tek primary.
5. Durum matrisi: boş / parse edildi / uyarılar / schema-kısmi / collision / fetch
   loading-error / review-open. Her biri gerçekten render edilmeli.
**Kabul:** Tek primary; dolu durumda özet gerçek sayıları gösterir; schema açılırı ekranı
ezmez; review diff okunur; narrow'da taşma yok; `dsv-*`/token tutarlı.
**Doğrulama (agent):** build + lint + `npx vitest run src/systems src/tokens`.
**Kontrolcü:** full suite + Playwright: `+` ve "Add tokens" aç → boş/dolu/review ekranları 1280 & 390.

---

## FLOW B — Sol rail toggle yeri + leading nav slot
**Skiller:** `layout` (birincil) + `polish` + `adapt`.
**Kapsam:** `app/src/App.tsx` (toggle'ı brand slotundan çıkar), `app/src/shell/Shell.tsx`
(yeni leading nav slotu), `app/src/shell/shell.css` (grid/ayraç/hizalama), `phoneTopbar.test`.
**Sorun:** Rail toggle marka kilidine gömülü; rail kolonuna hizalı değil; sağdaki props
toggle ile asimetrik; telefonda markayı sıkıştırıyor.
**Adımlar:**
1. `layout`: Shell'e brand'den ayrı bir **leading `nav` slotu** ekle; toggle'ı buraya al,
   `--app-rail-width`'e (208px literalini token'a çıkar) hizalı, trailing edge'de; brand ile
   arasına ince ayraç. Topbar grid'ini buna göre düzenle (mevcut `minmax(0,1fr) auto
   minmax(0,1fr)`'i bozmadan). Props toggle'ı sağ aksiyon kümesinde ayna olarak kalsın.
2. `adapt`: ≤480px iki-satırlı topbar'da toggle yerleşimi marka+switcher'ı sıkıştırmasın.
3. `polish`: ayraç, boşluk, focus ring, `aria-label`.
**Kontrat:** tek içerik scroller; chrome hareket etmez; `data-drawer-open` ve focus-return korunur.
**Kabul:** Toggle rail kolonuyla hizalı, brand'den ayrı; mobilde çakışma yok; `shellContract`,
`phoneTopbar`, `panels282` testleri yeşil (gerekiyorsa güncelle ve raporla).
**Doğrulama (agent):** build + lint + `npx vitest run src/shell src/App.test.tsx`.
**Kontrolcü:** full suite + Playwright 1280/390 topbar screenshot.

---

## FLOW C — Compare cilası (rail + Component/Token diff)
**Skiller:** `polish` + `distill` + `layout` + `adapt` + `clarify`.
**Kapsam:** `app/src/compare/{CompareRail,CompareView,CompareProps,CompareColumn,DiffTable}.tsx`,
`compare.css` (+ gerekiyorsa `App.tsx` loading wire'ı — dokunmadan önce bak).
**Sorun:** Seçim üç yerde tekrarlanıyor (rail özet + katalog + props); 240px kolonlarda
tam-sayfa ekranlar sıkışıyor; başlık/summary/filtre aynı ağırlıkta; mod anahtarı 208px'te
zor; mobile drawer'da rail/props davranışı; diff tarama zorluğu.
**Adımlar:**
1. `distill`: seçim tekrarını azalt — örn. rail'de "selected" özetini kompaktlaştır, props'u
   salt-okunur referans+özet yap; üç yerde aynı listeyi göstermeyi bırak.
2. `layout` + `polish`: içerik başlığı hiyerarşisi (Comparing/Reference/count); mod anahtarı
   sığsın; summary/filtre/table ağırlık farkı; satır hover/ayırıcı; sticky header kalksın.
3. Büyük bileşen stratejisi (sıkışma): kolon başına **ölçekli çerçeve** veya **sabit
   karşılaştırma viewport'u** — biri seçilip tutarlı uygulanır; 240px ham sıkışma kalmaz.
4. `adapt`: ≤900px drawer; kolonlar üst üste; taşma yok.
5. `clarify`: referans/diff dili ("changed" yalnız referansa göre), boş/loading mesajı.
**Kontrat:** P0 diff doğruluğu (referans = ilk kolon, tek veri kaynağı) korunur; per-kolon
token scope + `usePortalContainer()` korunur.
**Kabul:** Seçim tekrarı azaldı; büyük bileşenler okunur; başlık net; diff taranabilir;
mobile taşma yok; reference her yerde açık.
**Doğrulama (agent):** build + lint + `npx vitest run src/compare src/shell`.
**Kontrolcü:** full suite + Playwright compare (component + token diff) 1280 & 390.

---

## FLOW D — Final görsel QA + P3 temizliği (en son)
**Skiller:** `polish` + `audit`/bundled `detect` (+ gerekirse `extract`).
**Kapsam:** tüm `app/` (salt-okuma ağırlıklı) + küçük P3 düzeltmeleri (`review-log.md` P3).
**Adımlar:**
1. Playwright ile 3 tab × {1280, 768, 390} × {boş, dolu, uzun, hata} ekran görüntüleri; console
   hataları; gerçek taşma/örtüşme tespiti.
2. `detect` + kalan P3'ler (literal→token, kopya birliği, ölü kod).
3. Küçük düzeltmeleri yap, tekrar test.
**Kabul:** görsel QA listesindeki her madde kapatıldı; full suite/lint/build yeşil.

---

## Sıra / eşzamanlılık
- **A, B, C** dosya olarak bağımsız → paralel verilebilir (App.tsx yalnız B'de; çakışma yok).
  CPU için sıralı da olur; kontrolcü her birini ayrı doğrular.
- **D** en son (A/B/C birleştikten sonra tam görsel QA).
- Her akışın çıktısı: ne değişti + dosyalar + build/lint/hedefli test + skill'lere göre kabul notları.
