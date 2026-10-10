/*
 * Gallery contrast sweep — the helper the issue #109 counts come from.
 *
 * It walks every visible leaf text node in the running app, resolves the
 * effective text colour and the effective background (compositing translucent
 * colours and ancestor opacity), and reports every pair below WCAG AA (4.5:1).
 *
 * It has to run in the browser: contrast depends on the *resolved* token map
 * (system layer + dark variant), so the numbers can only come from
 * getComputedStyle on a live page — never from re-parsing the token strings.
 *
 * Usage (with the app served, e.g. `npm --prefix app run preview`):
 *   1. Open the app with the system under test, e.g. `?sys=aurora`.
 *   2. Switch to Preview and turn the Dark variant on.
 *   3. Paste this whole file into the DevTools console and call
 *      `runGalleryContrastSweep()`.
 *   Or, from Orca:
 *     orca eval --expression "<this file>; JSON.stringify(runGalleryContrastSweep())"
 *
 * The same sweep must be used before and after a fix: it excludes nothing by
 * selector and always uses the 4.5 normal-text threshold.
 */
function runGalleryContrastSweep() {
  var WHITE = [255, 255, 255];

  // Force a full style recalculation before measuring. Chromium skips style
  // recalc for off-screen content when the root custom properties change, so
  // `getComputedStyle` on a below-the-fold demo returns the previous variant's
  // (light) colours until the subtree is forced through layout. Toggling the
  // content scroller's display flushes every demo, visible or not, so the
  // sweep measures one variant consistently.
  function forceStyleRecalc() {
    var main = document.querySelector(".app-main") || document.body;
    var prev = main.style.display;
    main.style.display = "none";
    void main.offsetHeight;
    main.style.display = prev;
    void main.offsetHeight;
  }
  forceStyleRecalc();

  function parseColor(css) {
    var m = String(css).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3) return null;
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }

  function channel(v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function luminance(rgb) {
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  }

  function contrast(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function blend(fg, bg) {
    var a = fg[3];
    return [
      Math.round(fg[0] * a + bg[0] * (1 - a)),
      Math.round(fg[1] * a + bg[1] * (1 - a)),
      Math.round(fg[2] * a + bg[2] * (1 - a)),
    ];
  }

  function isVisible(el) {
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (el.getClientRects().length === 0) return false;
    return true;
  }

  // Effective background behind `el`: walk up compositing every translucent
  // background layer until an opaque one is reached; the page is the floor.
  function effectiveBg(el) {
    var stack = [];
    var node = el;
    while (node && node.nodeType === 1) {
      if (node.tagName === "HTML") break;
      var c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c[3] > 0) {
        stack.push(c);
        if (c[3] >= 1) break;
      }
      node = node.parentElement;
    }
    var out = parseColor(getComputedStyle(document.body).backgroundColor) || WHITE;
    out = out[3] >= 1 ? [out[0], out[1], out[2]] : WHITE;
    for (var i = stack.length - 1; i >= 0; i--) {
      var layer = stack[i];
      if (layer[3] >= 1) out = [layer[0], layer[1], layer[2]];
      else out = blend(layer, out);
    }
    return out;
  }

  // Cumulative opacity from the element up to body: an ancestor `opacity`
  // fades the text as a whole, the same mechanism that sank #88's disabled
  // buttons to 2.40:1.
  function effectiveOpacity(el) {
    var o = 1;
    var node = el;
    while (node && node.nodeType === 1 && node.tagName !== "HTML") {
      var v = parseFloat(getComputedStyle(node).opacity);
      if (!isNaN(v)) o *= v;
      node = node.parentElement;
    }
    return o;
  }

  function selectorOf(el) {
    var id = el.id ? "#" + el.id : "";
    var cls = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).join(".")
      : "";
    return el.tagName.toLowerCase() + id + cls;
  }

  var total = 0;
  var failures = [];
  var all = document.querySelectorAll("*");

  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE") continue;

    var text = "";
    for (var j = 0; j < el.childNodes.length; j++) {
      var n = el.childNodes[j];
      if (n.nodeType === 3) text += n.textContent;
    }
    text = text.trim();
    if (!text) continue;
    if (!isVisible(el)) continue;

    var fgRaw = parseColor(getComputedStyle(el).color);
    if (!fgRaw) continue;

    total++;
    var bg = effectiveBg(el);
    var opacity = effectiveOpacity(el);
    var fg = [
      fgRaw[0],
      fgRaw[1],
      fgRaw[2],
      Math.min(1, fgRaw[3] * opacity),
    ];
    var fgRgb = fg[3] >= 1 ? [fg[0], fg[1], fg[2]] : blend(fg, bg);
    var ratio = contrast(fgRgb, bg);
    if (ratio < 4.5) {
      failures.push({
        sel: selectorOf(el),
        text: text.slice(0, 32),
        ratio: Math.round(ratio * 100) / 100,
        color: "rgb(" + fgRgb.join(", ") + ")",
        background: "rgb(" + bg.join(", ") + ")",
      });
    }
  }

  failures.sort(function (a, b) {
    return a.ratio - b.ratio;
  });

  return {
    total: total,
    failures: failures.length,
    worst: failures.slice(0, 50),
  };
}

if (typeof window !== "undefined") {
  window.runGalleryContrastSweep = runGalleryContrastSweep;
}
