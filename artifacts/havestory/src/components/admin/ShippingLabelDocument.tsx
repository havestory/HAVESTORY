import {
  forwardRef,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowUp,
  Globe2,
  Hand,
  MapPin,
  MessageCircle,
  Phone,
  Umbrella,
  Wine,
} from "lucide-react";

const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "*": "nwnnwnwnn",
};
export function Code39Barcode({ value }: { value: string }) {
  const encoded = `*${value.toUpperCase().replace(/[^0-9A-Z. -]/g, "-")}*`;
  const bars: Array<{ x: number; width: number }> = [];
  let x = 8;
  for (const char of encoded) {
    const pattern = CODE39[char] || CODE39["-"];
    pattern.split("").forEach((part, index) => {
      const width = part === "w" ? 3 : 1;
      if (index % 2 === 0) bars.push({ x, width });
      x += width;
    });
    x += 1;
  }
  return (
    <div aria-label={`Invoice ${value}`}>
      <svg
        viewBox={`0 0 ${x + 8} 46`}
        style={{ height: 30, width: "100%", display: "block" }}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect width="100%" height="100%" fill="white" />
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y="2"
            width={bar.width}
            height="42"
            fill="black"
          />
        ))}
      </svg>
      <div
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          fontWeight: 700,
          lineHeight: 1.3,
          textAlign: "center",
          paddingTop: 3,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
    </div>
  );
}

type Props = {
  size?: "standard" | "a5";
  logo?: string;
  owner: string;
  senderAddress: string;
  senderPhone: string;
  recipient: string;
  address: string;
  phone: string;
  alternatePhone?: string;
  urgent: boolean;
  fragile: boolean;
  artwork?: string;
  deadline?: string;
  deadlineEn?: string;
  notes?: string;
  barcode?: React.ReactNode;
  qr?: React.ReactNode;
  showQr?: boolean;
  footer: string;
  whatsapp: string;
};

export const ShippingLabelDocument = forwardRef<HTMLDivElement, Props>(
  function ShippingLabelDocument(p, ref) {
    const frame = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    useImperativeHandle(ref, () => frame.current!, []);
    const width = p.size === "a5" ? 559 : 378;
    const height = p.size === "a5" ? 794 : 560;
    useLayoutEffect(() => {
      const fit = () => {
        if (
          !frame.current ||
          !content.current ||
          window.matchMedia("print").matches
        )
          return;
        setScale(
          Math.min(
            1,
            frame.current.clientHeight /
              Math.max(1, content.current.scrollHeight + 1),
          ),
        );
      };
      const observer = new ResizeObserver(fit);
      if (content.current) observer.observe(content.current);
      if (frame.current) observer.observe(frame.current);
      fit();
      return () => observer.disconnect();
    }, []);
    const row: CSSProperties = {
      display: "flex",
      alignItems: "center",
      gap: 4,
    };
    const block: CSSProperties = { flexShrink: 0 };
    return (
      <div
        ref={frame}
        className="label-print-target"
        style={{
          width,
          height,
          flexShrink: 0,
          background: "white",
          color: "black",
          overflow: "hidden",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          boxShadow: "0 8px 30px #0002",
        }}
      >
        <style>{`@media print{.shipping-label-content{width:var(--label-width)!important;transform:scale(calc(var(--label-scale) * var(--label-print-factor)))!important;transform-origin:top left!important}}`}</style>
        <div
          ref={content}
          className="shipping-label-content"
          style={
            {
              display: "flex",
              flexDirection: "column",
              width,
              minHeight: height - 1,
              transform: `scale(${scale})`,
              transformOrigin: "top center",
              "--label-width": `${width}px`,
              "--label-scale": scale,
              "--label-print-factor":
                ((p.size === "a5" ? 148 / 559 : 100 / 378) * 96) / 25.4,
            } as CSSProperties
          }
        >
          <header
            style={{
              ...block,
              textAlign: "center",
              borderBottom: "4px solid black",
              padding: "12px 12px 2px",
            }}
          >
            {p.logo ? (
              <img
                crossOrigin="anonymous"
                src={p.logo}
                alt="Business logo"
                style={{
                  width: 168,
                  height: 51,
                  objectFit: "contain",
                  display: "block",
                  margin: "0 auto 3px",
                }}
              />
            ) : (
              <div style={{ fontSize: 28, fontWeight: 900 }}>HAVESTORY</div>
            )}
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.06,
                textTransform: "uppercase",
                overflowWrap: "anywhere",
              }}
            >
              <div>{p.owner}</div>
              <div>{p.senderAddress.replace(/\s*\n\s*/g, ", ")}</div>
              <div>HOTLINE - {p.senderPhone}</div>
            </div>
          </header>
          {p.urgent && (
            <div
              style={{
                ...block,
                background: "#db1d20",
                color: "white",
                textAlign: "center",
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: 2,
                lineHeight: 1.25,
                padding: "2px 0",
                marginTop: 4,
              }}
            >
              URGENT DELIVERY
            </div>
          )}
          <section
            style={{
              ...block,
              padding: "8px 24px 12px",
              overflowWrap: "anywhere",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5 }}>
              DELIVER TO
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.3,
                marginTop: 6,
              }}
            >
              {p.recipient}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 7,
                fontSize: 15,
                fontWeight: 400,
                lineHeight: 1.5,
                marginTop: 9,
              }}
            >
              <MapPin
                aria-hidden="true"
                size={16}
                style={{ flexShrink: 0, marginTop: 3 }}
              />
              <div style={{ minWidth: 0, whiteSpace: "pre-line" }}>
                {p.address}
              </div>
            </div>
            <div
              style={{
                ...row,
                gap: 7,
                fontSize: 15,
                fontWeight: 400,
                lineHeight: 1.5,
                marginTop: 9,
                flexWrap: "wrap",
              }}
            >
              <Phone aria-hidden="true" size={16} />
              {p.phone}
              {p.alternatePhone && <span> / {p.alternatePhone}</span>}
            </div>
          </section>
          {p.fragile && (
            <section
              style={{ ...block, margin: "0 24px 7px", textAlign: "center" }}
            >
              {p.artwork ? (
                <img
                  crossOrigin="anonymous"
                  src={p.artwork}
                  alt="Fragile handling artwork"
                  style={{
                    display: "block",
                    width: "78%",
                    height: 105,
                    objectFit: "contain",
                    margin: "0 auto",
                  }}
                />
              ) : (
                <div
                  style={{
                    background: "#db1d20",
                    color: "white",
                    borderRadius: 15,
                    width: "78%",
                    margin: "0 auto",
                    padding: "3px 8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 27,
                      fontWeight: 900,
                      lineHeight: 1.15,
                      letterSpacing: 1,
                    }}
                  >
                    FRAGILE
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      border: "4px solid white",
                      padding: 2,
                      gap: 3,
                      margin: "3px auto",
                    }}
                  >
                    {[Wine, ArrowUp, Hand, Umbrella].map((Icon, i) => (
                      <span
                        key={i}
                        style={{ border: "2px solid white", padding: 2 }}
                      >
                        <Icon size={28} strokeWidth={2} />
                      </span>
                    ))}
                  </div>
                  <div
                    style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.25 }}
                  >
                    HANDLE WITH CARE
                  </div>
                </div>
              )}
            </section>
          )}
          {(p.deadline || p.deadlineEn) && (
            <section
              style={{
                ...block,
                border: "2px solid black",
                margin: "0 24px 4px",
                padding: "5px 4px",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1.35,
                overflowWrap: "anywhere",
              }}
            >
              {p.deadline && <div>{p.deadline}</div>}
              {p.deadlineEn && <div>{p.deadlineEn}</div>}
            </section>
          )}
          {p.notes && (
            <div
              style={{
                ...block,
                margin: "0 24px 4px",
                fontSize: 10,
                overflowWrap: "anywhere",
              }}
            >
              {p.notes}
            </div>
          )}
          <div style={{ ...block, padding: "0 24px 6px" }}>{p.barcode}</div>
          <footer
            style={{
              ...block,
              margin: "auto 21px 0",
              borderTop: "2px solid black",
              padding: "12px 0 8px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 11,
                lineHeight: 1.4,
                overflowWrap: "anywhere",
              }}
            >
              <div style={{ ...row, fontWeight: 900 }}>
                <Globe2 size={12} />
                VISIT HAVESTORY ONLINE
              </div>
              <div style={{ marginTop: 5 }}>{p.footer}</div>
              <div style={{ ...row, fontWeight: 800, marginTop: 5 }}>
                <MessageCircle size={12} />
                WhatsApp {p.whatsapp}
              </div>
              <div style={{ color: "#6b7280", fontSize: 10, marginTop: 6 }}>
                Scan to visit our website — explore products and order online.
              </div>
            </div>
            {p.showQr && p.qr}
          </footer>
        </div>
      </div>
    );
  },
);
