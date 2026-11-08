import Image from "next/image";

/**
 * A phone showing a real screenshot of the product. Every measurement is a percentage of the phone's own width or
 * height (corner radius, bezel, status bar, island, side keys), so it keeps the proportions of a real handset at any
 * size. Give it a height (or a width); the aspect ratio does the rest.
 */
export function PhoneMock({ src, alt, className = "", style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{ aspectRatio: "0.475", containerType: "inline-size", padding: "2.6%", borderRadius: "15% / 7%", ...style }}
      className={`relative shrink-0 bg-[linear-gradient(155deg,#4a4a54_0%,#17171c_38%,#0b0b0f_100%)] shadow-[0_28px_50px_-20px_rgb(0_0_0/0.7),0_0_0_1px_rgb(255_255_255/0.16)_inset] ${className}`}
    >
      {/* side keys */}
      <span aria-hidden className="absolute top-[17%] -left-[1.1%] h-[5%] w-[1.6%] rounded-l-sm bg-[#2b2b33]" />
      <span aria-hidden className="absolute top-[25%] -left-[1.1%] h-[8%] w-[1.6%] rounded-l-sm bg-[#2b2b33]" />
      <span aria-hidden className="absolute top-[35%] -left-[1.1%] h-[8%] w-[1.6%] rounded-l-sm bg-[#2b2b33]" />
      <span aria-hidden className="absolute top-[27%] -right-[1.1%] h-[12%] w-[1.6%] rounded-r-sm bg-[#2b2b33]" />

      <div className="relative h-full w-full overflow-hidden bg-white" style={{ borderRadius: "12.6% / 5.9%" }}>
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-white px-[9%] font-bold text-ink" style={{ height: "4.8%", fontSize: "3.6cqw" }} aria-hidden>
          <span>9:41</span>
          <span className="absolute top-[22%] left-1/2 h-[62%] w-[28%] -translate-x-1/2 rounded-full bg-[#0b0b0f]" />
          <span className="tracking-tighter">5G ▮▮▮</span>
        </div>
        <Image src={src} alt={alt} width={780} height={1688} unoptimized priority className="absolute inset-x-0 h-[95.2%] w-full object-cover object-top" style={{ top: "4.8%" }} />
      </div>
    </div>
  );
}
