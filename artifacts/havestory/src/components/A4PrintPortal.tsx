import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function useA4Print(delayMs = 180) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const finish = () => setActive(false);
    window.addEventListener("afterprint", finish);
    return () => window.removeEventListener("afterprint", finish);
  }, []);
  const print = () => { setActive(true); window.setTimeout(() => window.print(), delayMs); };
  return { active, print };
}

const PRINT_CSS = `
  .pb-a4-print-root { display: none; }
  @media print {
    @page { size: A4 portrait; margin: 11mm; }
    @page report { size: A4 portrait; margin: 36mm 11mm 16mm; }
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; }
    body > *:not(.pb-a4-print-root) { display: none !important; }
    .pb-a4-print-root { display: block !important; width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; color: #111827; background: #fff; }
    .pb-a4-print-root, .pb-a4-print-root * { box-sizing: border-box !important; }
    .pb-a4-print-root article, .pb-a4-print-root .a4, .pb-a4-print-root .verification-a4 { width: 100% !important; max-width: none !important; min-height: 0 !important; margin: 0 !important; padding-left: 0 !important; padding-right: 0 !important; border-radius: 0 !important; box-shadow: none !important; position: static !important; overflow: visible !important; }
    .pb-a4-print-root table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
    .pb-a4-print-root thead { display: table-header-group !important; }
    .pb-a4-print-root tfoot { display: table-row-group !important; }
    .pb-a4-print-root th, .pb-a4-print-root td { overflow-wrap: anywhere !important; word-break: break-word !important; }
    .pb-a4-print-root tr, .pb-a4-print-root img, .pb-a4-print-root .avoid-break, .pb-a4-print-root .break-inside-avoid, .pb-a4-print-root .pb-print-keep { break-inside: avoid !important; page-break-inside: avoid !important; }
    .pb-a4-print-root .pb-print-flow { break-inside: auto !important; page-break-inside: auto !important; }
    .pb-a4-print-root .no-print { display: none !important; }
    .pb-a4-print-root .pb-report-document { page: report; width: 100% !important; }
    .pb-a4-print-root .pb-report-letterhead { display: block !important; position: fixed !important; top: -29mm !important; left: 0 !important; right: 0 !important; height: 25mm !important; margin: 0 !important; padding: 0 0 3mm !important; border-bottom: 1px solid #6b2f7b !important; background: #fff !important; z-index: 5; }
    .pb-a4-print-root .pb-report-document table { font-size: 9pt !important; }
  }
`;

export function A4PrintPortal({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active || typeof document === "undefined") return null;
  return createPortal(<div className="pb-a4-print-root"><style>{PRINT_CSS}</style>{children}</div>, document.body);
}
