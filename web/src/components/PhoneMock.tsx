import Image from "next/image";

/** A phone frame showing a real screenshot of the product, under a proper status bar. */
export function PhoneMock({ src, alt, className = "", style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={`relative shrink-0 rounded-[2.1rem] bg-[#15151a] p-[5px] shadow-[0_30px_60px_-18px_rgb(0_0_0/0.65),0_0_0_1.5px_rgb(255_255_255/0.14)_inset] sm:rounded-[2.6rem] sm:p-[7px] ${className}`}
    >
      <div className="relative overflow-hidden rounded-[1.75rem] bg-white sm:rounded-[2.2rem]" style={{ aspectRatio: "390 / 844" }}>
        <div className="absolute inset-x-0 top-0 z-10 flex h-[4.8%] items-center justify-between bg-white px-[8%] text-[6px] font-bold text-ink sm:text-[9px]" aria-hidden>
          <span>9:41</span>
          <span className="absolute top-1/2 left-1/2 h-[58%] w-[27%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b0b0f]" />
          <span className="tracking-tighter">5G ▮▮▮</span>
        </div>
        <Image src={src} alt={alt} width={780} height={1688} unoptimized priority className="absolute inset-x-0 top-[4.8%] h-[95.2%] w-full object-cover object-top" />
      </div>
      <span aria-hidden className="absolute top-24 -right-[3px] h-14 w-[3px] rounded-r bg-[#2b2b33] sm:h-16" />
    </div>
  );
}
