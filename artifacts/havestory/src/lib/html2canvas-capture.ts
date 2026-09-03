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

/**
 * Color CSS properties that html2canvas reads and that Tailwind v4 can
 * emit as oklch() tokens. We copy computed values for all of these as
 * explicit inline !important styles so html2canvas's own CSS parser only
 * ever sees rgb()/rgba() values — even when the source stylesheet is a
 * linked <link> file (production builds) that we cannot rewrite in place.
 */
const COLOR_PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "caret-color",
] as const;

/**
 * Convert any CSS color string (including oklch/oklab) to an sRGB rgb() string
 * by rendering a single pixel onto an off-screen canvas. The canvas API always
 * resolves to sRGB, so this works for every modern color space.
 *
 * Returns the original string unchanged if no oklch/oklab is present, or
 * "transparent" as a safe fallback on any error.
 */
function resolveColorToRgb(color: string): string {
  if (!color || !/okl(?:ch|ab)/i.test(color)) return color;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "transparent";
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a === 255
      ? `rgb(${r},${g},${b})`
      : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
  } catch {
    return "transparent";
  }
}

/**
 * APPROACH 1 — Stylesheet sanitisation (works in Vite dev mode where CSS is
 * injected as <style> elements).
 *
 * Walk all <style> elements in the cloned document and replace every oklch()/
 * oklab() token with its sRGB rgb() equivalent so that html2canvas's own CSS
 * parser never encounters a color function it cannot handle.
 */
function sanitizeOklchInStylesheets(doc: Document): void {
  const OKLCH_RE = /okl(?:ch|ab)\([^)]+\)/gi;

  doc.querySelectorAll("style").forEach((styleEl) => {
    const text = styleEl.textContent ?? "";
    if (!OKLCH_RE.test(text)) return;
    OKLCH_RE.lastIndex = 0;
    styleEl.textContent = text.replace(OKLCH_RE, (match) =>
      resolveColorToRgb(match),
    );
  });
}

/**
 * APPROACH 2 — Inline style override (belt-and-suspenders; also covers Vite
 * production builds where CSS ships as a linked <link> file that cannot be
 * rewritten in place).
 *
 * For every element in the cloned document, read the computed color-related
 * properties from the corresponding live original element, convert any oklch/
 * oklab values to rgb(), and stamp them as inline !important styles. After
 * this, html2canvas reads the inline styles (which win the cascade) and only
 * ever sees rgb()/rgba() values.
 *
 * @param liveRoot  The original live element passed to html2canvas.
 * @param clonedEl  The root of html2canvas's internal cloned element.
 */
function inlineComputedColors(
  liveRoot: HTMLElement,
  clonedEl: HTMLElement,
): void {
  const liveNodes = [liveRoot, ...Array.from(liveRoot.querySelectorAll<HTMLElement>("*"))];
  const cloneNodes = [clonedEl, ...Array.from(clonedEl.querySelectorAll<HTMLElement>("*"))];

  liveNodes.forEach((src, i) => {
    const dst = cloneNodes[i];
    if (!dst || !(dst instanceof HTMLElement)) return;
    try {
      const computed = window.getComputedStyle(src);
      for (const prop of COLOR_PROPS) {
        const raw = computed.getPropertyValue(prop);
        if (!raw || raw === "none") continue;
        const safe = resolveColorToRgb(raw);
        if (safe) dst.style.setProperty(prop, safe, "important");
      }
    } catch {
      /* skip SVG / pseudo elements */
    }
  });
}

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
 * Captures a DOM element to an HTMLCanvasElement.
 *
 * Root-cause fix for html2canvas + Tailwind v4 oklch crash
 * ─────────────────────────────────────────────────────────
 * Tailwind v4 emits oklch()/oklab() color tokens in its generated stylesheet.
 * html2canvas ships its own CSS parser which does NOT understand oklch/oklab
 * and throws during rendering, causing "Failed to generate image."
 *
 * Two complementary fixes run inside onclone:
 *
 * 1. sanitizeOklchInStylesheets — rewrites every <style> element in the cloned
 *    document, replacing oklch()/oklab() tokens with canvas-resolved rgb()
 *    values. Effective in Vite dev mode (CSS in <style> tags).
 *
 * 2. inlineComputedColors — reads getComputedStyle() from the live original
 *    elements, converts any oklch result to rgb() via canvas, and stamps the
 *    result as inline !important styles on the cloned elements. Effective in
 *    production builds (CSS in linked <link> files that can't be rewritten)
 *    and as a belt-and-suspenders layer in dev mode.
 *
 * Additional fixes:
 *  – React-controlled input .value properties are copied into both the
 *    intermediate clone and html2canvas's internal clone (cloneNode only
 *    copies HTML attributes, not the JS .value property React manages).
 *  – Clone placed at left:-9999px to avoid scroll-offset artefacts.
 *  – document.fonts.ready + 150 ms delay ensures custom fonts are loaded.
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

  // ── Layer 1: inject preflight into live document head ─────────────────────
  const preflightStyle = document.createElement("style");
  preflightStyle.textContent = PREFLIGHT_CSS;
  document.head.appendChild(preflightStyle);

  // ── Font readiness ────────────────────────────────────────────────────────
  await document.fonts.ready;
  await new Promise<void>((resolve) => setTimeout(resolve, 150));

  // ── Off-screen fixed wrapper ──────────────────────────────────────────────
  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "position:fixed",
    "top:0",
    "left:-9999px",
    `width:${width}px`,
    `height:${height}px`,
    `overflow:${overflow}`,
    "background:#fff",
    "z-index:2147483647",
    "pointer-events:none",
  ].join(";");

  const clone = el.cloneNode(true) as HTMLElement;
  // Keep the source root's inline layout declarations. Replacing cssText here
  // used to erase display:flex/grid, flex-direction, font and background
  // declarations from fixed-size labels/invoices. The live preview therefore
  // looked correct while the exported clone reflowed vertically.
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.overflow = overflow;
  clone.style.position = "relative";
  clone.style.flexShrink = "0";
  clone.style.boxShadow = "none";
  clone.style.boxSizing = "border-box";

  // ── Copy React-controlled input values into the intermediate clone ─────────
  const liveInputs = Array.from(
    el.querySelectorAll<HTMLInputElement>("input, textarea, select"),
  );
  const cloneInputs = Array.from(
    clone.querySelectorAll<HTMLInputElement>("input, textarea, select"),
  );
  liveInputs.forEach((liveInput, i) => {
    const cloneInput = cloneInputs[i];
    if (cloneInput) cloneInput.value = liveInput.value;
  });

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
      // A tainted canvas cannot be serialized with toDataURL/toBlob, which
      // made invoice downloads appear to do nothing when a remote logo lacked
      // permissive CORS headers. Skip unsafe pixels instead of tainting output.
      allowTaint: false,
      imageTimeout: 12_000,
      logging: false,
      onclone: (_doc: Document, clonedEl: HTMLElement) => {
        // ── Fix 1: rewrite oklch tokens in all <style> elements ───────────
        // Effective for Vite dev mode where CSS is injected as <style> tags.
        sanitizeOklchInStylesheets(_doc);

        // ── Fix 2: stamp computed colors as inline !important styles ──────
        // Reads live computed styles (getComputedStyle on the original DOM),
        // converts any oklch/oklab values to rgb(), and applies them as inline
        // styles on the cloned elements. This wins the CSS cascade so html2canvas
        // always sees rgb(). Covers production linked-CSS builds that Fix 1
        // cannot rewrite.
        inlineComputedColors(el, clonedEl);

        // ── Clone geometry ────────────────────────────────────────────────
        clonedEl.style.overflow = overflow;
        clonedEl.style.height = `${height}px`;
        clonedEl.style.width = `${width}px`;
        clonedEl.style.boxSizing = "border-box";

        // ── Layer 2: stylesheet inside the clone ──────────────────────────
        const st = _doc.createElement("style");
        st.textContent = PREFLIGHT_CSS;
        _doc.head.appendChild(st);

        // ── Layer 3: fix img/svg display mode ─────────────────────────────
        clonedEl
          .querySelectorAll<HTMLElement>("img, svg, canvas, video")
          .forEach((imgEl) => {
            imgEl.style.display = "inline-block";
            imgEl.style.verticalAlign = "middle";
            imgEl.style.maxWidth = "none";
          });

        // ── Copy input values into html2canvas's internal clone ───────────
        const clonedInputsInner = Array.from(
          clonedEl.querySelectorAll<HTMLInputElement>(
            "input, textarea, select",
          ),
        );
        liveInputs.forEach((liveInput, i) => {
          const clonedInput = clonedInputsInner[i];
          if (clonedInput) clonedInput.value = liveInput.value;
        });
      },
    });

    return canvas;
  } finally {
    document.body.removeChild(wrap);
    document.head.removeChild(preflightStyle);
  }
}
