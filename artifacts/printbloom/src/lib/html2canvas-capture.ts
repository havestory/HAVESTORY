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
 * Convert any CSS color string (including oklch/oklab) to an sRGB rgb() string
 * by rendering a single pixel onto an off-screen canvas. The canvas API always
 * resolves to sRGB, so this works for every modern color space.
 *
 * Returns "transparent" if conversion fails (invalid color, security error, etc.)
 */
function resolveColorToRgb(color: string): string {
  if (!color) return color;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return color;
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
 * Walk all <style> elements in a document and replace every oklch()/oklab()
 * token with its sRGB rgb() equivalent so that html2canvas's own CSS parser
 * never encounters a color function it cannot handle.
 *
 * We use a regex rather than a full CSS parse so we can do the conversion even
 * on minified/concatenated Tailwind output. The pattern is safe because:
 *  – oklch/oklab do not nest parentheses in the wild,
 *  – [^)]+ is greedy and stops at the first ")" so it handles all arg variants.
 */
function sanitizeOklchInStylesheets(doc: Document): void {
  const OKLCH_RE = /okl(?:ch|ab)\([^)]+\)/gi;

  doc.querySelectorAll("style").forEach((styleEl) => {
    const text = styleEl.textContent ?? "";
    if (!OKLCH_RE.test(text)) return; // reset lastIndex and skip if clean
    OKLCH_RE.lastIndex = 0;

    styleEl.textContent = text.replace(OKLCH_RE, (match) =>
      resolveColorToRgb(match)
    );
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
 * Root-cause fix for html2canvas + Tailwind v4:
 *  Tailwind v4 emits oklch()/oklab() color tokens in its generated stylesheet.
 *  html2canvas ships its own CSS parser which does NOT understand oklch/oklab
 *  and throws a parse error when it encounters them, aborting the capture.
 *
 *  We fix this at the source: inside the onclone callback we walk every <style>
 *  element in the cloned document and replace each oklch()/oklab() token with
 *  its sRGB rgb() equivalent (resolved via a single-pixel canvas draw). After
 *  this replacement html2canvas's parser only sees rgb()/rgba() values and
 *  succeeds. Inline overrides (layers 1–3 below) remain as belt-and-suspenders
 *  for any edge-case color values that might slip through from other sources.
 *
 * Additional fixes baked in:
 *  – Input/textarea .value properties are copied from the live original to both
 *    the intermediate clone and html2canvas's internal clone (cloneNode only
 *    copies HTML attributes, not React-controlled .value JS properties).
 *  – Clone is placed at left:-9999px to avoid scroll-offset artefacts.
 *  – document.fonts.ready + 100 ms delay ensures custom fonts are loaded.
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
  clone.style.cssText = [
    `width:${width}px`,
    `height:${height}px`,
    `overflow:${overflow}`,
    "position:relative",
    "flex-shrink:0",
    "box-shadow:none",
    "box-sizing:border-box",
  ].join(";");

  // ── Copy React-controlled input values to the intermediate clone ──────────
  // cloneNode(true) copies HTML attributes but NOT the .value JS property
  // that React sets on controlled <input>/<textarea> elements.
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
      allowTaint: true,
      logging: false,
      onclone: (_doc: Document, clonedEl: HTMLElement) => {
        // ── PRIMARY FIX: strip oklch/oklab from all cloned stylesheets ────
        // This is the definitive fix. html2canvas's own CSS parser throws on
        // oklch()/oklab() tokens. We convert every occurrence in every <style>
        // element of the cloned document to sRGB rgb() via a canvas pixel read
        // before html2canvas has a chance to parse them.
        sanitizeOklchInStylesheets(_doc);

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
        // html2canvas creates its own internal clone from our `clone`. The
        // intermediate copy above handled our clone; repeat here for safety.
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
