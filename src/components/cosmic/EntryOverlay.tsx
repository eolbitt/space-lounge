"use client";

type Props = {
  visible: boolean;
  onEnter: () => void;
};

export function EntryOverlay({ visible, onEnter }: Props) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col justify-end transition-opacity duration-1000 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060f] via-[#05060f]/45 to-transparent" />

      <div className="relative mx-auto w-full max-w-3xl px-6 pb-16 pt-24 sm:pb-20">
        <p className="font-sans text-xs tracking-[0.22em] text-[#9eb0c4] uppercase">
          Space Lounge
        </p>
        <p className="mt-3 font-display text-[clamp(2.3rem,7.5vw,4.4rem)] leading-[1.08] tracking-tight text-[#eef3f7]">
          혼자지만,
          <br />
          <span className="whitespace-nowrap">같은 우주에 있는 사람들</span>
        </p>
        <p className="mt-5 max-w-md font-sans text-base leading-relaxed text-[#a8b8c8] sm:text-lg">
          작은 우주인이 되어 3D 우주를 천천히 떠다니세요. 드래그로 시야를 돌리고,
          말은 없이 같은 밤하늘 어딘가의 이와 스쳐 지납니다.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onEnter}
            disabled={!visible}
            className={`pointer-events-auto rounded-full border border-[#c8d4e0]/40 bg-[#e8eef4]/10 px-6 py-3 font-sans text-sm tracking-wide text-[#eef3f7] backdrop-blur-sm transition hover:border-[#e8eef4]/70 hover:bg-[#e8eef4]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9eb8c8] ${
              visible ? "" : "pointer-events-none"
            }`}
          >
            우주로 들어가기
          </button>
          <span className="font-sans text-xs tracking-wider text-[#7a8a9a]">
            침묵의 공존 · MVP
          </span>
        </div>
      </div>
    </div>
  );
}
