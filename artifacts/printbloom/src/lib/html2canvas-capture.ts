import html2canvas from "html2canvas";

/**
 * CSS injected into BOTH the live document head and the html2canvas clone
 * to neutralise Tailwind's preflight  img { display: block }  rule, which
 * shifts text baselines during canvas rendering.
 */
const PREFLIGHT_CSS = [
  "img,svg,canvas,video{display:inline-block!important;vertical-align:middle!important;max-width:none!important;}",
  "table{border-collapse:collapse!important;}",
  "*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}",
].join("");

export interface CaptureOptions {
  /** Capture width in CSS pixels */
  width: number;
  /** Capture height in CSS pixels */
  height: number;
  /** Device-pixel-ratio / canvas scale. Default: 2 */
  scale?: number;
  /** Canvas background colour. Default: "#ffffff" */
  backgroundColor?: string;
  /**
   * When true the clone uses overflow:visible so tall report cards
   * are captured in full. Default: false (clips to height, suitable
   * for fixed-height A4 invoice pages).
   */
  overflowVisible?: boolean;
}

/**
 * Captures a DOM element to an HTMLCanvasElement, neutralising the
 * Tailwind CSS preflight  img { display: block }  rule that shifts text
 * baselines during html2canvas rendering.
 *
 * Fix strategy (three layers so one always wins):
 *
 *  1. Inject a <style> tag into the LIVE document <head> BEFORE the
 *     html2canvas call. html2canvas copies all stylesheets into the
 *     cloned document, so the fix travels with it. The tag is removed
 *     in a finally block — it never leaks.
 *
 *  2. Inside onclone, inject the same <style> into the clone's <head>
 *     directly, so even if stylesheet propagation is skipped it is there.
 *
 *  3. Inside onclone, walk every img/svg/canvas/video with querySelectorAll
 *     and set inline styles directly — inline + !important beats everything.
 *
 * Other best-practices baked in:
 *  - Clone is appended at left:-9999px (not left:0) to avoid scroll offsets.
 *  - document.fonts.ready + 100 ms delay so custom fonts (Google Fonts/Inter)
 *    are fully loaded before the capture, preventing text-alignment drift.
 */
export async function captureElement(
  el: HTMLElement,
  opts: CaptureOptions,
): Promise<HTMLCanvasElement> {
  const {
    width,
    height,
    scale = 2,
    backgroundColor = "#ffffff",
    overflowVisible = false,
  } = opts;

  const overflow = overflowVisible ? "visible" : "hidden";

  // ── Layer 1: inject override into the live document ───────────────────────
  const preflightStyle = document.createElement("style");
  preflightStyle.textContent = PREFLIGHT_CSS;
  document.head.appendChild(preflightStyle);

  // ── Font readiness ────────────────────────────────────────────────────────
  await document.fonts.ready;
  await new Promise<void>(resolve => setTimeout(resolve, 100));

  // ── Off-screen fixed wrapper ──────────────────────────────────────────────
  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "position:fixed", "top:0", "left:-9999px",
    `width:${width}px`,
    `height:${height}px`,
    `overflow:${overflow}`,
    "background:#fff",
    "z-index:2147483647",
    "pointer-events:none",
  ].join(";");

  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.cssText = [
    `width:${width}px`,
    `height:${height}px`,
    `overflow:${overflow}`,
    "position:relative",
    "flex-shrink:0",
    "box-shadow:none",
    "box-sizing:border-box",
  ].join(";");

  wrap.appendChild(clone);
  document.body.appendChild(wrap);

  try {
    const canvas = await html2canvas(clone, {
      scale,
      width,
      height,
      scrollX: 0,
      scrollY: 0,
      backgroundColor,
      useCORS: true,
      allowTaint: true,
      logging: false,
      onclone: (_doc: Document, clonedEl: HTMLElement) => {
        clonedEl.style.overflow = overflow;
        clonedEl.style.height = `${height}px`;
        clonedEl.style.width = `${width}px`;
        clonedEl.style.boxSizing = "border-box";

        // ── Layer 3: imperative inline-style fix ──────────────────────────
        clonedEl.querySelectorAll<HTMLElement>("img, svg, canvas, video").forEach(imgEl => {
          imgEl.style.display = "inline-block";
          imgEl.style.verticalAlign = "middle";
          imgEl.style.maxWidth = "none";
        });

        // Tailwind v4 can emit oklch/oklab paint values. html2canvas versions
        // that do not understand those functions throw while parsing the clone.
        // Copy browser-resolved RGB paint values inline so the clone remains
        // visually identical without asking html2canvas to parse the source
        // color function.
        const originalNodes = [el, ...Array.from(el.querySelectorAll<HTMLElement>("*"))];
        const clonedNodes = [clonedEl, ...Array.from(clonedEl.querySelectorAll<HTMLElement>("*"))];
        clonedNodes.forEach((node, index) => {
          const source = originalNodes[index];
          if (!source) return;
          try {
            const computed = window.getComputedStyle(source);
            [
              "color", "backgroundColor", "borderTopColor", "borderRightColor",
              "borderBottomColor", "borderLeftColor", "outlineColor",
              "textDecorationColor", "columnRuleColor", "caretColor", "fill", "stroke",
            ].forEach(property => {
              const value = computed.getPropertyValue(property);
              if (value) node.style.setProperty(property, value, "important");
            });
            ["backgroundImage", "boxShadow", "textShadow"].forEach(property => {
              const value = computed.getPropertyValue(property);
              if (value && !/oklch|oklab/i.test(value)) node.style.setProperty(property, value, "important");
              else if (/oklch|oklab/i.test(value)) node.style.setProperty(property, "none", "important");
            });
          } catch {
            // A single inaccessible style must not abort the full document export.
          }
        });

        // ── Layer 2: stylesheet inside the clone ──────────────────────────
        const st = _doc.createElement("style");
        st.textContent = PREFLIGHT_CSS;
        _doc.head.appendChild(st);
      },
    });

    return canvas;
  } finally {
    document.body.removeChild(wrap);
    document.head.removeChild(preflightStyle);
  }
}
