# Sol rail yeniden tasarımı — impeccable sırası (maximum verim)

**Kapsam:** Sol rail (`.app-rail*` — `shell/Rail.tsx`, `shell/RailGroup.tsx`,
`shell.css` rail bloğu, `lib/scrollspy.ts`). **Sağ rail (`props`) ve `.app-props*`
dokunulmaz.** Büyük olasılıkla sadece rail'in *iç* içeriği değişir; shell grid
konteynerleri (`.app-rail-clip`, `.app-rail`) sabit kalır.
**Mod:** Operate. **Hedef:** verimli + uygulamanın geri kalanıyla uyumlu.
**Bilinen şikâyet:** ekran kaydırıldıkça aktif elemanın değişmesi (scrollspy +
kayan gösterge) kötü çalışıyor.

**Kısıtlar (agentlar bağlı):** shell kontratı (chrome hareket etmez, tek scroll =
`.app-main`; rail içi kendi çerçevesinde kayabilir, `overflow: hidden` yasak →
`clip`); sağ rail'e dokunma; dark mode emekli; token'lar çıplak `var(--token)`;
reduced-motion korunur; `app-*` önekleri; testler (`shellContract`, `motion284`,
`chromeTypography`, `Rail.test`, `RailGroup.test`, `railEllipsis286`, `panels282`).

## Sıra (sırayla agenta verilir)

| # | Komut | Girdi/rol | Çıktı |
|---|---|---|---|
| 0 | `impeccable context` | (yapıldı) | bağlam |
| 1 | `critique` | Sol rail (`Rail.tsx`, `RailGroup.tsx`, shell.css rail bloğu, scrollspy.ts) | Heuristic skor + P0-P3 (scrollspy/gösterge/İA/keşfedilebilirlik) |
| 2 | `audit` | `shell/` rail ekseni | a11y (klavye/listbox/reduced-motion) + perf (scrollspy, layout-anim gösterge) + responsive (çekmece) |
| 3 | `shape` | "sol rail yeniden tasarımı" | Onaylı brief: İA, gruplama, seçim modeli, scrollspy modeli, klavye modeli, mobil, **anti-referans** ve dokunulmazlar |
| 4 | `distill` | brief'e göre | İA'yı özüne indir; gereksiz affordance/tekrarı at |
| 5 | `layout` | rail | Yerleşim, hiyerarşi, ritim (grup↔link ilişkisi, ölçü) |
| 6 | `animate` | rail | Kaydırma + gösterge hareketi: **asıl şikâyet** — tek, otorite edilmiş an; jump-cut değil; reduced-motion güvenli |
| 7 | `bolder` | rail | Etkileşim imzası; app'in ölçülü dünyasında "kesin" ama gürültüsüz |
| 8 | `clarify` | rail | Grup etiketleri, arama affordance'ı, ipuçları |
| 9 | `adapt` | rail | Dar ekran/telefon çekmecesi + dokunma hedefleri |
| 10 | `delight` | rail | (opsiyonel) hak edilmişse küçük mikro-etkileşim |
| 11 | `polish` | rail | Son kalite: durumlar, kontrast, kenar durumları, temizlik |
| 12 | `audit` + `critique` + `detect` | rail | Yeniden doğrula (trend + tarama) |
| 13 | `extract` | rail | Yeniden kullanılabilir desen/komponent çıktıysa |

## Yürütme kaydı

- 0 tamam. Hedef `app/`, platform web, incumbent görsel dünya mevcut.
- Ön tarama (app/ geneli) `docs/ui-review/findings.md`'de; rail ile ilgili:
  scrollspy/gösterge jank, klavye tab tuzağı, keşfedilemez etkileşim, reduced-motion
  açığı (gösterge/chevron — düzeltildi), başlık seviyesi (düzeltildi).

### Sonuçlar

| Adım | Sonuç |
|---|---|
| 1 critique (rail) | 19/36 önce; scrollspy kökü: tık↔spy "current" anlaşmazlığı (3 offset + pin), ikinci-saat gösterge, 50vh pad, 145 tab stop |
| 2 audit (rail) | 15/20 önce; indicator layout-anim, `--ease-*` sapması, düz klavye, çekmece hedefleri |
| 3 shape | Brief onaylandı (4 karar: bölüm-birim / Compare taksonomisi+kapalı varsayılan / alt boşluk / focus tuzağı+kilit) |
| 4-11 build (tek tutarlı geçiş) | Bölüm-birim, tek `--app-rail-landing-offset`, pin kaldırıldı, kayan gösterge silindi (satır-başı aktif), önbellekli spy, roving focus, arama rail'e, sticky aile başlığı, `aria-current="location"`, `<nav>` |
| 12 verify (critique+audit) | Contract **karşılandı**; audit **17/20**, critique **12/16**; P2: yinelenen DOM id + 27 satır Screens |
| 12b residual fixes | `useId()` ile id tekilleştirme, tıkta tab stop takibi, literal→token, tab-bazlı nav etiketi |
| 12c tests | `npm test` **633/633**, lint temiz, build temiz, render `detect` 13 (yeni regresyon yok) |

### Açık kalan / karar bekleyen

- **Screens ailesi 27 düz satır** (bilişsel yük). Alt-gruplama bir tasarım kararı (shape) —
  bu turda kapsam dışı bırakıldı.
- **Tokens rail'de arama yok**: token-adı filtresi toolbar'da kaldı (rail'e taşımak kontrolü
  çiftlerdi); tutarlılık için istenirse ayrı bir iş.
- Rail satır linkleri `href="#id"` ile hash geçmişi ekliyor (legacy de böyleydi). Back-tuşu
  şikâyeti gelirse `replaceState`'e çevrilir.

