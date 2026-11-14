# UI review log (app/) — waves 1–2

Kalıcı kayıt. Her satır: `[P?] ID — sorun — file:line`. Envanter: `inventory.md`.

## Dalga 1 — B01–B06

### B01 Shell chrome
- [P2] OR-002 — Telefon "More actions" popover adsız dialog (`role=dialog`, isim yok) — Shell.tsx:146
- [P3] OR-001 — Kapalı panelde masaüstünde 1px divider dikişi — shell.css:435/543
- [P3] OR-001 — Panel genişlikleri (208/300) ve z-index literal — shell.css:450/465/547/560, 67/834/41
- [P3] OR-003 — Tab hedefi ~22px, kendi 44px token'ının altında — shell.css:408-420
- [P3] OR-003 — Aktif tab yüzey düzleşince yalnız renk farkı — shell.css:422-425
- [P3] AT-010 — Skip link geometrisi literal — shell.css:37-50

### B02 Topbar actions & brand
- [P2] AT-003 — 28px hit target (telefonda tek affordance) — shell.css:367
- [P2] AT-004 — Toggle'un adı state'le değişiyor (aria-pressed ile gereksiz çift) — IconToggleButton.tsx:17-19
- [P2] MO-053 — `.app-pill` focus-visible yok — shell.css:790/App.tsx:646
- [P2] MO-053 — `.app-pill` hover yok + press feedback dışında — index.css:53-67
- [P2] MO-054 — Telefon popover seçimde kapanmıyor — Shell.tsx:146-148
- [P3] MO-054 — Adsız dialog + iki özdeş "dots" ikonu — Shell.tsx:137-148 / SystemMenu.tsx:49-55
- [P3] AT-003/MO-053 — aria-label override / birleşik ad — IconActionButton.tsx:17-21, App.tsx:652-653
- [P3] MO-053 — 26px vs 28px yükseklik cluster'ı kaydırıyor — shell.css:795/367

### B03 System switcher & menu
- [P1] OR-016 — Rename input ref her render'da `el.select()` → tek karakter yazılabiliyor — SystemMenu.tsx:110-112
- [P2] OR-015 — Rename'de yinelenen ad koruması yok → yanlış sistem silme riski — SystemMenu.tsx:40-44 / store.ts:349-366
- [P3] OR-014 — Switcher chrome literal'leri (6/8/24px, 500, 99px) — shell.css:183,221,223,239,250,264
- [P3] OR-014 — Uzun ad menü satırında taşabilir (min-width:auto, ellipsis yok) — shell.css:218-230
- [P3] OR-014 — Coverage % erişilebilir adın içinde — SystemSwitcher.tsx:82-89
- [P3] OR-016 — label "Name" vs aria-label "System name" çelişkisi — SystemMenu.tsx:103-109
- [P3] AT-017 — Select trigger açık/disabled state yok — forms.css:82-88

### B04 Rail frame + nav + groups
- [P1] MO-050 — Grup chevron'u `data-state` almadığı için hiç dönmüyor — RailGroup.tsx:67-79 / shell.css:686
- [P2] MO-051 — Search Escape'i tüketmiyor; ≤900px tek Esc hem aramayı hem çekmeceyi kapatıyor — SectionSearch.tsx:36 / App.tsx:164-166
- [P2] MO-051 — Search input 30px + clear 24px (touch floor altı) — shell.css:295,329-330
- [P3] OR-004/005 — RailFrame/PropsFrame kod tekrarı; genişlik literal iki yerde — RailFrame.tsx / PropsFrame.tsx / shell.css:450/465/547/560
- [P3] OR-006 — Auto-reveal kapalı rail'de (0 genişlik) yine ölçüp scrollTop yazıyor — Rail.tsx:196-197
- [P3] OR-006 — Aileler açılıyor ama hiç kapanmıyor (outline zamanla tamamen açık) — Rail.tsx:80-86
- [P3] MO-050 — `aria-controls` kapalıyken dangling — RailGroup.tsx:71/82
- [P3] MO-051 — Arama landmark değil (`role=search` yok) — SectionSearch.tsx:26
- [P3] AT-044 — Count erişilebilir adın içinde bağlamsız ("Button 11") — Rail.tsx:245-246

### B05 Gallery primitives
- [P2] AT-002 — Paylaşılan Button'da focus-visible ring yok — gallery.css:87
- [P2] MO-001/AT-051 — Field hint/error id'siz; aria-describedby yok — ui.tsx:75-88
- [P2] OR-020 — Header row frame kontrolüyle dar ekranda taşıyor (wrap yok) — gallery.css:39,43
- [P2] AT-007 — Badge adı yalnız sayı; focus-visible yok; has-edits=is-active aynı görünüm — tokenInspector.tsx:561-570 / css:30-45
- [P3] AT-002 — Danger hover surface token'ı yazı token'ı olarak kullanıyor — gallery.css:124-125
- [P3] AT-051 — Inline error badge gibi, bölüm hatası notice gibi (iki dil) — gallery.css:146
- [P3] OR-019 — Demo id yalnız title; yinelenebilir — ui.tsx:100
- [P3] OR-021 — Simüle genişlik frame'de duyurulmuyor — ui.tsx:180-184
- [P3] AT-007 — 10.5px mikro tipografi floor'u atlıyor — tokenInspector.css:96,168

### B06 Form atoms
- [P1] AT-011 — Hint/error programatik bağlı değil (aria-describedby yok) — forms.tsx:73-74
- [P2] AT-011 — Focus yalnız border rengi (~2:1), token ring yok — gallery.css:142
- [P2] AT-012 — `[aria-invalid]` yalnız input'ta; textarea'da yok — gallery.css:144
- [P2] AT-013 — Disabled `opacity:.5` (token değil) + focus-visible yok — forms.css:50,42
- [P2] AT-014 — RadioGroup adı yok + focus-visible yok — forms.tsx:161 / forms.css:51
- [P2] AT-015 — Switch geometrisi raw px + disabled opacity — forms.css:60,67,69,71,65
- [P2] AT-016 — Slider thumb focus-visible yok + değer readout bağsız — forms.css:76 / forms.tsx:193
- [P2] AT-049 — Sayaç hiç saymıyor (statik "18/30"), hint ile çift — forms.tsx:101,98
- [P2] AT-050 — Disabled label+kontrol farklı mekanizma — forms.css:7,50,65
- [P3] AT-011 — Placeholder disabled token'ı — gallery.css:141
- [P3] AT-052 — Açıklama ikon token'ı iddia ediyor ama etmiyor — forms.tsx:123

## Dalga 2 — B07–B12

### B07 Validation
- [P1] MO-001 — Field hint/error id'siz, describedBy yok — ui.tsx:84-88
- [P2] MO-001/AT-051 — Hata `role=alert`/aria-live yok; Field aria-invalid'i yönetmiyor — ui.tsx:85,75-91
- [P2] MO-002 — Form row gap/wrap yok (dar Compare'da çarpışır) — validation.css:6
- [P2] MO-003 — Boş submit'te iki çelişkili hata — validation.tsx:53,56
- [P2] MO-003 — Client invalid'de `data-invalid` stili yok (kutu kırmızılaşmıyor) — validation.css:7 / gallery.css:144
- [P2] MO-003 — Başarılı submit formu remount edip focus'u body'ye düşürüyor — validation.tsx:28
- [P2] MO-003 — "✓ submitted" duyurulmuyor — validation.tsx:67
- [P2] MO-004 — Şifre toggle aria-label dinamik etiketi eziyor — validation.tsx:81
- [P2] MO-004 — `id="v-pass"` Compare'da çakışıyor — validation.tsx:80
- [P2] AT-011 — Forms input id'leri Compare'da çakışıyor (prefix yok) — forms.tsx çok yer
- [P2] AT-011 — Sayaç çift/statik; error metni bağsız — forms.tsx:98,101,73-75
- [P3] MO-005 — OTP "of 6" bağlamı düşüyor + tamamlanma/hata state yok — validation.tsx:14,12-18

### B08 Nav primitives
- [P2] AT-017 — Select trigger open/hover/focus/disabled state yok; content min-width yok — forms.css:82-93
- [P2] AT-019 — Disabled toggle ayırt edilemiyor + focus-visible yok — gallery.css:243-251
- [P2] AT-020 — Seçili orta segment accent border'ının bir kenarını kaybediyor — gallery.css:252-255
- [P2] AT-041 — Menubar trigger keyboard highlight stilsiz — navigation.css:7-15
- [P2] AT-042 — Disabled tab stili/demosu yok — navigation.css:28-36
- [P2] OR-045 — Tablist adı yok + panel yüksekliği sabit değil (reflow) — navigation.tsx:81 / css:37
- [P2] OR-043 — Menubar root adı yok — navigation.tsx:25
- [P2] OR-044 — Nav menu viewport 320px sabit, soldan hizalı; motion yok — navigation.css:17-23
- [P2] MO-029 — Toggle group layout class yok; iki kontrol yüksekliği; iç içe role=toolbar — navigation.tsx:106,119,105
- [P3] AT-041 — Chevron label'a yapışıyor — navigation.css:7-11

### B09 Overlays
- [P2] OR-052 — Dialog input id'leri Compare'da çakışıyor — overlays.tsx:43,46
- [P2] OR-054 — Popover adsız dialog + `p-w/p-h` id çakışması — overlays.tsx:100,104,107
- [P2] OR-055 — "Sign out" destructive+trash (yanlış); Theme submenu seçili state yok — overlays.tsx:163-165,156-158
- [P2] OR-058 — Mega popover adsız dialog; 9 item aynı anchor + kapanmıyor — overlays.tsx:228,234
- [P3] OR-056 — Context trigger aria-haspopup/aria-label yok — overlays.tsx:174
- [P3] OR-057 — HoverCard trigger dead/self link — overlays.tsx:201
- [P3] AT-029 — Tooltip adı trigger aria-label ile aynı (çift) — overlays.tsx:120,126
- [P3] AT-036 — Kısayol glifleri adın içinde; "Account" grup etiketi değil — overlays.tsx:145,143
- [P3] AT-037/AT-035 — Checked satır tek girintili / ikon kolonu tutarsız — overlays.tsx:185,144
- [P3] AT-038 — Close scroll eden modalda kayıyor — overlays.tsx:57-61 / gallery.css:6,172
- [P3] AT-039 — Popover arrow fill var, edge yok (dikiş) — gallery.css:194
- [P3] OR-058 — Başlıkta `shadow-xl` token değil — overlays.tsx:222

### B10 Feedback atoms
- [P1] MO-068 — Hata toast'ları polite+atomic; tüm stack yeniden okunuyor; assertive olmalı — Toasts.tsx:64
- [P2] MO-068 — warn/err tonu AA altı olabilir (raw warning/danger renk) — Toasts.css:78,83
- [P2] MO-068 — Hata toast'ı 2600ms'de kayboluyor, kapatma yok — toasts.ts:24 / Toasts.tsx:66-72
- [P2] AT-025 — Spinner adsız empty span; disabled butondaki loading duyurulmuyor — gallery.css:282 / status.tsx:150
- [P2] AT-026 — Skeleton loading semantiği yok — status.tsx:130-146
- [P2] AT-027 — Progress `width` animasyonlu (transform değil) — feedback.css:6
- [P2] AT-028 — Separator başlığı yanlış token'ı etiketliyor — layout.tsx:101 / css:34-37
- [P2] MO-015 — Banner dismiss focus'u body'ye düşürüyor — status.tsx:104-111
- [P3] AT-021 — Badge nowrap yok; boyut rampası eksik — gallery.css:258-264
- [P3] AT-024 — Chord key-sequence gibi; ⌘ platforma sabit — feedback.tsx:71
- [P3] MO-014 — Callout tonları ikonla ayrışmıyor; danger x (kapat) glifi — status.tsx:70,87,93
- [P3] OR-059 — Demo toast re-trigger flash + `--z-toast` chrome altına düşebilir — feedback.tsx:10-13 / feedback.css:8

### B11 Status molecules & empty/drop
- [P2] MO-013 — Empty state `role=status` yok — status.tsx:117
- [P2] MO-015 — Dismiss <24×24 + hover/focus-visible yok — status.tsx:105 / gallery.css:373
- [P2] OR-009 — Welcome chrome tip floor'u atlıyor + focus/press yok + boş scroll slack + copy — Welcome.css:11,17,42,31-49 / shell.css:524
- [P2] OR-010 — Drop overlay çok az karartıyor + ".css" copy yanlış (.json) — Welcome.css:68 / Welcome.tsx:34
- [P2] OR-011 — Banner `role=status` butonları sarıyor; sticky değil; type floor; "N dropped" jargon — SharedSystemBanner.tsx:26,29 / css:14,35
- [P2] MO-067 — "Open" session-only, söylenmiyor; üç eşit ağırlıklı aksiyon; hover/focus yok — App.tsx:113-119 / SharedSystemBanner.css:28-36
- [P3] OR-009 — Upload copy `.json` eksik — Welcome.tsx:22

### B12 Data display & typography
- [P1] AT-023 — Avatar beyaz baş harfler 8 dolgunun 4'ünde kontrast düşük — screenBits.tsx:30-32
- [P2] AT-023 — Baş harfler avatar boyutuyla ölçeklenmiyor — gallery.css:235
- [P2] AT-023 — Avatar erişilebilir adı çift/ilan edilmemiş — screenBits.tsx:30-35
- [P2] AT-031 — Scroll'lu kod bloğu klavyeyle erişilemiyor — gallery.css:420
- [P2] AT-032 — `clamp()` fluid display, etiketlediği boyutta render etmiyor — gallery.css:568-582
- [P2] AT-033 — Lede measure yok — gallery.css:590
- [P2] MO-009 — "Active" kesirli sayı; delta polaritesi yanlış (churn kırmızı); tabular-nums yok — dataDisplay.tsx:160,158,241
- [P2] MO-010 — Hero stili tanımlı ama kullanılmıyor — gallery.css:592
- [P2] MO-012 — Timeline'da her düğüm "current" — gallery.css:514
- [P2] OR-051 — Tablo sıralaması leksikografik (Version/Size yanlış); compact density çalışmıyor; native checkbox; th tıklanabilir; caption/scroll focus yok — dataDisplay.tsx:43,66,60,71-84,63-67
- [P3] AT-032/033/034/OR-051 — çeşitli tipografi/tablo cila

## Dalga 3 — B13–B18

### B13 Navigation extras
- [P2] MO-017 — Breadcrumb inline textDecoration hover underline'ı eziyor; nav adı yok — navExtras.tsx:20-25
- [P2] MO-018 — Disabled prev/next opacity fade (proje kuralına aykırı); hover disabled'ı boyuyor — gallery.css:472,468
- [P2] MO-019 — Segmented 3 bağımsız aria-pressed toggle; grup rolü/adı yok — navExtras.tsx:84,92
- [P2] MO-020 — Align trio inert/state'siz; Tooltip.Provider boş (ölü) — navExtras.tsx:101-130,111
- [P2] AT-054 — Aktif step forced-colors'da görünmez; tamamlanma yalnız renk/ikon — gallery.css:500 / navExtras.tsx:75
- [P3] MO-016 — Steps role=list (ol değil) + yatay iç scroll — navExtras.tsx:67 / gallery.css:476

### B14 Product patterns
- [P1] MO-024 — Inline edit input'unun erişilebilir adı yok — patterns.tsx:228-234
- [P1] OR-048 — Combobox seçeneklerinde hover/focus feedback yok (outline:none, data-highlighted hiç set edilmiyor) — patterns.tsx:135-152 / gallery.css:206
- [P2] MO-021 — Stepper yazılan değeri clamp etmiyor; focus clip — patterns.tsx:167,172 / patterns.css:23
- [P2] MO-022 — Rating seçim programatik değil; boş yıldız ~1.8:1 — patterns.tsx:188-199 / css:35
- [P2] MO-023 — Copy hiç kopyalamıyor ama "Copied" gösteriyor; duyuru yok — patterns.tsx:212-217
- [P2] MO-025 — Dropzone drag-over sahte (hover/focus); click browse yok — patterns.tsx:315-319
- [P2] MO-026 — `var(--color-chart-${i})` token tarayıcıyı bozuyor — patterns.tsx:377
- [P2] MO-030 — Kısayol tablosu `<Demo>` dışında (başlık/anchor/rail yok) — patterns.tsx:439
- [P2] OR-047 — Takvim: hafta başlıkları belirsiz; "Selected" ay gezinmesinde yalan; grid/ok yok — patterns.tsx:59,80,58-78
- [P2] OR-049 — Tree ARIA geçersiz (treeitem doğrudan çocuk olmalı); roving yok — patterns.tsx:259-285
- [P2] OR-050 — Bar serisi a11y ağacında yok; SVG adları içeriksiz — patterns.tsx:344-357
- [P3] MO-030/OR-047 — macOS-only kısayollar / hardcoded İngilizce başlık

### B15 Layout molecules
- [P1] MO-007 — Presence avatar 3 boyutta render olmuyor (cascade; hepsi 40px) — layout.css:49 / gallery.css:233
- [P2] MO-008 — Avatar group beyaz başharf 4/8 dolguda AA altı — screenBits.tsx:32
- [P2] OR-042 — Accordion focus ring `overflow:hidden` ile kırpılıyor (görünmez) — layout.css:6,9-16
- [P2] OR-046 — ScrollArea thumb ~1.6:1, hover/active yok — layout.css:115-117
- [P3] AT-045 — Presence dot yalnız title'da; boyut oranı sıçrıyor; ham renk — layout.tsx:123 / layout.css:54,58
- [P3] MO-028 — Aspect demo tamamen aria-hidden (tek içerik); ölü img kuralı — layout.tsx:221 / layout.css:119
- [P3] MO-027 — Collapsible label nesneyi düşürüyor ("Hide"); liste semantiği yok — layout.tsx:77,80-84

### B16 Token inspector
- [P1] MO-047 — Escape taslağı iptal etmiyor, kaydediyor (blur→commit eski draft) — tokenInspector.tsx:138-171
- [P1] AT-007 — Badge erişilebilir adı yalnız sayı — tokenInspector.tsx:561-570
- [P2] OR-022 — Docked panelde head kayıyor, gövde kendi scroll'u inert — tokenInspector.css:93
- [P2] OR-022 — Mobil dialog portalı usePortalContainer() atlıyor — PreviewProps.tsx:94-95
- [P2] OR-022 — Inspector chrome'u sistem motion token'ı kullanıyor (--motion-*) — tokenInspector.css:36,54,62,66
- [P2] OR-023 — Grup etiketleri başlık/grup değil — tokenInspector.tsx:355-357
- [P2] MO-046 — Escape tüm inspector'ı kapatıyor (picker yerine); seçim sonrası focus body — tokenInspector.tsx:87-97,255
- [P2] MO-047 — Renk input hex olmayan değeri #888'e çeviriyor — tokenInspector.tsx:35,145
- [P2] MO-048 — Undo hedefleri ~12px; mode toggle aria-expanded yok — tokenInspector.css:111-115 / tsx:234
- [P2] AT-007 — 761-900px bandında badge click hiçbir şey yapmıyor; has-edits=is-active aynı — tokenInspector.tsx:566 / css:39-45

### B17 Preview props/notes
- [P2] OR-039 — Docked panel kapanınca focus body'ye düşüyor — tokenInspector.tsx:523,398
- [P2] OR-040 — Telefonda aynı scope için iki üst üste çekmece (760 vs 900 eşiği) — tokenOverrides.ts:260 / App.tsx:389
- [P2] OR-040 — Mobil dialog hedefleri desktop boyutunda (44px değil) — tokenInspector.css:111-134
- [P2] MO-070 — Sistem değişince eski "font yok" listesi kalıyor — PreviewNotes.tsx:34-50
- [P3] OR-041 — Tüm durumlar eşit ağırlıklı banner; loading iki implementasyon — PreviewNotes.tsx:135 / App.tsx:486
- [P3] MO-069 — Schema notu font-warning class'ı kullanıyor — PreviewNotes.tsx:20
- [P3] MO-071 — Retry in-flight/disabled yok, 32px — PreviewNotes.tsx:94-97

### B18 Tokens toolbar & dialogs
- [P1] OR-032 — "Fill missing template" yapıştırılan CSS'i onaysız yok ediyor — TokenDialog.tsx:92-98
- [P2] OR-025 — Toolbar roving, segmented'in ok sarmasını kaçırıyor (defaultPrevented yok) — TokenToolbar.tsx:43-69
- [P2] OR-025 — Filtre temizleyince focus düşüyor; 2 clear affordance; focus ring yok — TokenToolbar.tsx:101 / css:29-55
- [P2] OR-032 — İlk focus paste kutusunda değil; 4 fiil karışık; scrim hover tint (4%) — TokenDialog.tsx:81,75 / css:213
- [P2] MO-041 — success/warning fill token (AA altı); kaç token ezileceği yazmıyor — CssPreview.tsx:38 / css:318
- [P2] MO-042 — Busy "…" (duyurulmuyor), inputlar disabled değil — CssSourceBar.tsx:71-80
- [P2] MO-045 — .tok-btn focus-visible yok (UA ring) — TokenToolbar.css:99-117
- [P3] OR-024 — Empty state missing-group listesiyle çelişiyor — TokensView.tsx:99-115

## Dalga 4 — B19–B24

### B19 Tokens gallery groups & rows
- [P1] OR-026 — Missing-token adları AA altı kontrast (`--color-warning`) — TokenGroup.css:80-85
- [P1] MO-031 — Çift tık 3 kez kopyalıyor (click×2 + dblclick onPick) — rows.tsx:70-74
- [P1] MO-031 — Focus ring ~1.99:1 (accent-border) + paylaşılan ring token'ı değil — rows.css:424-430
- [P2] OR-026/MO-031 — Tokens chrome `--font-size-*` (floor `--app-*` değil); 11px'e düşüyor — TokenGroup.css:30,76 / rows.css çok
- [P2] OR-026 — 500px placeholder tahmini gerçek grup yüksekliğinden çok uzak → anchor sapması — TokenGroup.css:13-17
- [P2] OR-027/MO-034 — Her listbox aynı `aria-label="Tokens"`; grup adı yok; listbox klavye modeli yarım (roving yok) — rows.tsx:91
- [P2] OR-028 — Ramp + kalan swatch iki aynı-adlı listbox; iç yatay scroller temassız/unthemed — rows.tsx:247 / rows.css:131
- [P2] OR-028 — Ramp breakpoint viewport'a bakıyor (kolona değil) — rows.css:211
- [P2] OR-029 — "Light" stage aslında inverse (koyu); gölge kayboluyor — rows.tsx:313 / rows.css:318
- [P2] OR-029 — Büyük gölgeler 32px stage'den komşu satıra taşıyor — rows.css:305
- [P2] MO-032 — TypeRow ölçümü yalnız window resize'da (panel/sistem/mount'ta bayat) — rows.tsx:419-439
- [P2] MO-032 — Gizli sizer satırı aşıyor (phantom yatay scroll) — rows.tsx:472-485
- [P2] MO-033 — Ramp cell token adını hiç göstermiyor/duyurmuyor — rows.tsx:268-285
- [P2] MO-035 — Swatch selection yalnız 1.99:1 border — rows.css:86
- [P2] AT-056 — Neredeyse beyaz swatch'ın sınırı görünmüyor — rows.css:91
- [P3] AT-008 — `role=img` metin glifte + yer tutarsız — rows.tsx:10,80,131

### B20 Tokens schema/contrast/props
- [P2] OR-030 — Grid klavye modeli yok; 800+ tab stop — SchemaView.tsx:66,82
- [P2] OR-030 — Sabit ad kolonu değer kolonunu açlığa uğratıyor (901-1100px) — SchemaView.css:22
- [P2] OR-031 — Badge metni bildirdiği AA'yı kendisi geçemiyor — ContrastSection.css:82-95
- [P2] OR-031 — "Could not calculate" hata gibi render — useContrastRows.ts:89
- [P2] OR-033 — Props panel chrome tip floor'unu atlıyor — TokensProps.css çok
- [P2] MO-037 — %100 gösterirken token eksik olabiliyor (rounding) — TokensProps.tsx:76,151
- [P2] MO-038 — Contrast link Schema/arama modunda ölü; linkler 24px altı — TokensProps.tsx:119 / css:177
- [P2] MO-039 — Inspector'da "okuma" durumu yok (form hep açık) — TokensProps.tsx:204
- [P2] MO-040 — Uyarı nedeni hover-only; warning rengi AA altı — TokensProps.tsx:236 / css:143
- [P2] MO-043 — Cancel/Escape iptal etmiyor (draft kalmış, form mounted) — InlineEditor.tsx:50-88
- [P2] MO-043 — Boş/değişmemişte Save sessiz no-op — InlineEditor.tsx:50-54
- [P3] MO-044 — Popover dialog adsız; iki kaydet semantiği; Add "updated" diyor — InlineEditor.tsx:158,141,138

### B21 Add-system dialog
- [P1] OR-013 — Merge modunda hatalar hiç render edilmiyor (review dalı error'ı öldürüyor) — AddSystemDialog.tsx:968-978
- [P1] OR-013 — "Replace it" tek tıkla geri dönüşsüz üzerine yazma, güvenli seçeneklerle aynı stil — AddSystemDialog.tsx:954-963 / store.ts:325
- [P1] MO-061 — Merge modunda System name alanı ölü kontrol (yazılan atılıyor) — AddSystemDialog.tsx:936-945
- [P2] OR-013 — "Fill with schema" buffer'ı değiştiriyor ama source satırı bayat — AddSystemDialog.tsx:569,637
- [P2] OR-013 — Write mode Review'den sonra seçiliyor → review yanlış şekli raporluyor — AddSystemDialog.tsx:896 vs 787
- [P2] OR-013 — Cancel/Escape'te dirty guard yok — AddSystemDialog.tsx:530,980
- [P2] OR-013 — Dialog açıkken sayfa drop'u modal arkasına yazıyor — App.tsx:321
- [P2] OR-013 — Dialog chrome tip floor'suz; focus tutarsız — AddSystemDialog.css:57,140
- [P2] MO-059 — "Fill with schema" en az işaretli yıkıcı; tooltip "insert" diyor — AddSystemDialog.tsx:569
- [P2] MO-062 — Filtre sırasında grup başlıkları tıklanabilir ama no-op — SchemaFill.tsx:138,145
- [P2] MO-064 — Değer uyarıları/present-missing yalnız görsel; clear 22×22 — SchemaFill.tsx:165 / css:196
- [P2] MO-064 — Her tuşta 6-8 tam CSS parse — SchemaFill.tsx:56
- [P2] OR-018 — Coverage import metnine göre, sonuç sisteme göre değil — SchemaFill.tsx:121
- [P2] MO-041 — "tokens pasted" her kaynak için yanlış; üçüncü live region — CssPreview.tsx:37,36
- [P3] MO-060 — Stepper done/pending renk-only, Back dışında gezinilemez — AddSystemDialog.tsx:647

### B22 Compare rail & props
- [P2] OR-035 — Arama sırasında grup başlıkları ölü toggle (staticLabel yok) — CompareRail.tsx:147
- [P2] OR-035 — `?cmp=` sanitize edilmiyor (dupe/clamp yok) — useCompareView.ts:39 / urlState.ts:91
- [P2] OR-035 — İki arama alanı iki farklı dil — compare.css:148 vs shell.css:288
- [P2] OR-036 — Satır kaldırma focus'u body'ye düşürüyor — CompareProps.tsx:33
- [P2] OR-036 — Props/kolon sırası rail pick sırasıyla çelişiyor (katalog sırası) — useCompareView.ts:91
- [P2] OR-036 — Coverage % yalnız title'da — CompareProps.tsx:25
- [P2] MO-055 — Dot gereksiz ikinci seçim göstergesi; % üç dilde — CompareRail.tsx:130 / compare.css:180
- [P3] OR-035 — Sabit `cmp-system-filter` id (useId değil); çift rail-top boşluk — CompareRail.tsx:97 / compare.css:143

### B23 Compare columns & diff
- [P1] OR-038 — "missing" exclusive tür → gerçek farkları gizliyor (varsayılan Different) — DiffTable.tsx:139-149
- [P2] OR-034/OR-037 — Kolon sırası katalog sırası; referans kolon görünmez (değişen çoğunluğu suçlayabilir) — useCompareView.ts:91 / DiffTable.tsx:216
- [P2] OR-037 — Eksik tokenlar aktif sistemin :root değerlerini miras alıyor — CompareColumn.tsx:49 / App.tsx:370
- [P2] OR-037 — `.cmp-col { overflow:hidden }` portalled içeriği kırpıyor (kontrat ihlali) — compare.css:65
- [P2] OR-038 — Aynı swatch'lar "different" sınıflanabiliyor (var() çözülmüyor) — DiffTable.tsx:141
- [P2] OR-038 — Sticky thead aslında yapışmıyor — compare.css:92,98
- [P2] OR-038 — Sabit token-adı kolonu telefon ekranını yutabiliyor — compare.css:122
- [P2] MO-056 — İki bağımsız toggle tek seçim (segmented değil); focus ring yok — CompareView.tsx:23 / compare.css:31
- [P2] MO-058 — Dört sayı aynı ağırlık/renk (tarama zor) — DiffTable.tsx:157 / compare.css:93
- [P3] OR-038/MO-057 — tablo adsız; satır etiketi tekrar; filtre sayısız/etiketsiz

### B24 Compare registry (Basics)
- [P1] — Gallery-section seçenekleri (Forms/Validation/Login) Compare'da hâlâ id çakıştırıyor (prefix yok) — registry.tsx:285 / forms.tsx:70 / validation.tsx:77 / login.tsx:18
- [P2] — Kolon bölgesi aria-labelledby yok (tekrarlanan demo etiketleri belirsiz) — CompareColumn.tsx:52
- [P2] — Demo state kolon başına ayrı, etkileşimde senkrondan çıkıyor — registry.tsx:62
- [P2] — `.cmp-col { overflow:hidden }` (yine) — compare.css:65
- [P2] — Buttons/Giris: icon+loading demo yok; error mesajı bağlı değil; Selects aria-label "Language" görünen değeri içermiyor — registry.tsx:21,48,114
- [P2] — Controls yalnız "on" durumu; Progressy adsız/value yok — registry.tsx:62,225

## Dalga 5 — B25–B29 (screens + runtime)

### B25 Screens: data & product
- [P1] screen-viz/dashboard/analytics/report — sayfa gutter'ı yok (içerik frame kenarına yapışık) — viz.tsx:9 / gallery.css screen-frame
- [P1] screen-dashboard — aynı satırda "." ondalık ve binlik ayırıcı (₺48.2k vs 1.284) — dashboard.tsx:13
- [P1] screen-analytics — iki grafik adsız; SVG adları anlamsız ("trend"/"share") — analytics.tsx:40-73
- [P2] screen-viz — eksen plot'tan kopuk; değerler hover-only — viz.tsx:34,24
- [P2] screen-dashboard — düşüş her zaman danger (error rate düşüşü kırmızı); kart 3 konu — dashboard.tsx:15,54
- [P2] screen-analytics — segmented kontrol hiçbir şeyi değiştirmiyor; "2d 41s" yanlış — analytics.tsx:20,97
- [P2] screen-files — satır aksiyonu/hover yok; storage toplamı listeyle uyuşmuyor — files.tsx:35,6
- [P2] screen-report — başlık viewport clamp (frame'e duyarlı değil); gutter yok — report.tsx:18,5
- [P2] screen-activity — success tonu yok (accent); "view all" kendi section'ına atlıyor — activity.tsx:15,48
- [P3] screen-files/table — `overflow:hidden` (kontrat ihlali) — files.tsx:34 / table.tsx:25

### B26 Screens: auth & forms
- [P1] screen-profile — avatar başharf kontrastı ~2.2:1 — profile.tsx:17 / screenBits.tsx:29
- [P2] screen-login — form yok (Enter submit etmiyor); "forgot password" yok; remember-me opt-out — login.tsx:18,37
- [P2] screen-signup — her adım aynı Team formu; Finish bitiremiyor; hint bağsız — signup.tsx:33,36
- [P2] screen-onboarding — tek input "Value"; adımlar doğrulanamıyor — onboarding.tsx:50
- [P2] screen-settings — Save/Reset inert; tab geçişi uncontrolled state kaybediyor; confirm delete = cancel — settings.tsx:129,66,112
- [P2] screen-checkout — form/required yok; billing checkbox anlamsız — checkout.tsx:20,53
- [P3] — Phone frame'de sayfa gutter'ı yok (checkout/signup/onboarding/settings/profile)

### B27 Screens: content lists
- [P2] screen-inbox — listbox roving/ok yok — inbox.tsx:33
- [P2] screen-search — facet grup rolü yok; facet/pagination sadece kendini boyuyor — search.tsx:23,13
- [P2] screen-team — status hep "Active" (ton role göre); invite boş email kabul — team.tsx:7,39
- [P2] screen-notifications — "Mark all as read" unread state yok/handler yok — notifications.tsx:26
- [P2] screen-chat — spinner block bubble'da inline çöküyor; transcript log/live değil — chat.tsx:35,27
- [P2] screen-schedule — haftada tarih/today yok; açıklama sticky sub-nav diyor ama yok — schedule.tsx:5 / index.ts:160
- [P3] screen-team — `tm-e` id Compare'da çakışıyor — team.tsx:39

### B28 Screens: commerce & misc
- [P1] screen-pricing — period switch'in erişilebilir adı yok — pricing.tsx:27
- [P2] screen-billing — invoice surface yok (thead band'ı yanlış) — billing.tsx:22
- [P2] screen-table — `overflow:hidden`; 6 satır aynı "Actions"; dialog id çakışması — table.tsx:25,111,66
- [P2] screen-kanban — avatar kontrast + isim title-only — kanban.tsx:32
- [P2] screen-upload — dropzone/browse sahte, dosya input'u yok — upload.tsx:15
- [P2] screen-command — palette statik (filtre/combobox/focus yok) — commandPalette.tsx:22
- [P2] screen-marketing — hero CTA stili ölü (Button specificity); display vw clamp frame'i yok sayıyor — marketing.tsx:35,26
- [P3] screen-empty — breadcrumb kendine link; screen-404 — iki "home" + 404 başlık değil

### B29 Error boundary & toasts
- [P1] OR-012 — ErrorBoundary tüm chrome'u sarıyor; fallback "bir bölüm çöktü" diyor (yanlış); switcher'a erişim yok — App.tsx:604 / ErrorBoundary.tsx:38
- [P1] OR-012 — "Try again" deterministik re-throw döngüsü; reload/reset yok — ErrorBoundary.tsx:34
- [P2] OR-012 — fallback kendi butonunu kırpabiliyor; ham error.message sızıyor; tema çöken tokendan; focus düşüyor — ErrorBoundary.tsx:48 / css
- [P2] OR-008 — hata toast'ları polite; süre 2.6s kapatma yok — Toasts.tsx:64 / toasts.ts:24
- [P2] MO-068 — warn metin AA altı (~3.19:1); toast tip floor'suz; ham exception — Toasts.css:76 / tsx:71
