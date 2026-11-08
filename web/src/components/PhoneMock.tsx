import Image from "next/image";

/**
 * A phone showing a real screenshot of the product, or live content passed as children. Every measurement is a
 * percentage of the phone's own width or height (corner radius, frame, bezel, status bar, island, side keys), so it
 * keeps the proportions of a real handset at any size. Give it a height (or a width); the aspect ratio does the rest.
 * Children are laid out in container units: 100cqw is the phone's width.
 *
 * Built like the real thing: a thin brushed-titanium edge, a black glass bezel, then the screen under a faint glare.
 */
export function PhoneMock({
  src,
  alt,
  children,
  screenRef,
  frameRef,
  className = "",
  style,
}: {
  src?: string;
  alt?: string;
  children?: React.ReactNode;
  screenRef?: React.Ref<HTMLDivElement>;
  /** The edge and bezel, so a scroll effect can dissolve the hardware and leave just the screen. */
  frameRef?: React.Ref<HTMLDivElement>;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ aspectRatio: "0.475", containerType: "inline-size", borderRadius: "15% / 7%", ...style }} className={`relative shrink-0 ${className}`}>
      <div ref={frameRef} aria-hidden className="absolute inset-0" style={{ borderRadius: "15% / 7%" }}>
        {/* titanium edge, lit from the top left */}
        <div className="absolute inset-0 shadow-[0_50px_90px_-40px_rgb(0_0_0/0.65),0_22px_36px_-22px_rgb(0_0_0/0.45)]" style={{ borderRadius: "15% / 7%", background: "linear-gradient(140deg,#f1f2f4 0%,#a7a9b0 14%,#55575e 42%,#2f3035 60%,#8c8f97 86%,#e2e3e7 100%)" }} />
        {/* side keys */}
        <span className="absolute top-[17%] -left-[0.9%] h-[5%] w-[1.3%] rounded-l-sm bg-[linear-gradient(90deg,#6e7178,#b9bbc1)]" />
        <span className="absolute top-[25%] -left-[0.9%] h-[8%] w-[1.3%] rounded-l-sm bg-[linear-gradient(90deg,#6e7178,#b9bbc1)]" />
        <span className="absolute top-[35%] -left-[0.9%] h-[8%] w-[1.3%] rounded-l-sm bg-[linear-gradient(90deg,#6e7178,#b9bbc1)]" />
        <span className="absolute top-[27%] -right-[0.9%] h-[12%] w-[1.3%] rounded-r-sm bg-[linear-gradient(270deg,#6e7178,#b9bbc1)]" />
        {/* black glass bezel */}
        <div className="absolute bg-[#050506]" style={{ inset: "0.9%", borderRadius: "14.2% / 6.6%", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.08)" }} />
      </div>

      <div ref={screenRef} className="absolute overflow-hidden bg-white" style={{ inset: "2.7%", borderRadius: "12.6% / 5.9%" }}>
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-white px-[9%] font-bold text-ink" style={{ height: "4.8%", fontSize: "3.6cqw" }} aria-hidden>
          <span>9:41</span>
          <span className="absolute top-[22%] left-1/2 h-[62%] w-[28%] -translate-x-1/2 rounded-full bg-[#050506]" />
          <span className="tracking-tighter">5G ▮▮▮</span>
        </div>
        {children ?? (src && <Image src={src} alt={alt ?? ""} width={780} height={1688} unoptimized priority className="absolute inset-x-0 h-[95.2%] w-full object-cover object-top" style={{ top: "4.8%" }} />)}
        {/* glass glare */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(118deg,rgb(255_255_255/0.22)_0%,rgb(255_255_255/0.06)_28%,transparent_42%)]" />
      </div>
    </div>
  );
}
