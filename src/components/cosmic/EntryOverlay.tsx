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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070c] via-[#05070c]/55 to-transparent" />

      <div className="relative mx-auto w-full max-w-3xl px-6 pb-16 pt-24 sm:pb-20">
        <p className="font-display text-[clamp(2.4rem,8vw,4.6rem)] leading-[1.05] tracking-tight text-[#eef3f7]">
          혼자지만,
          <br />
          같은 우주에 있는 사람들
        </p>
        <p className="mt-5 max-w-md font-sans text-base leading-relaxed text-[#a8b8c8] sm:text-lg">
          작은 우주인이 되어 천천히 유영하세요. 말은 없습니다. 같은 밤하늘
          어딘가에 다른 이가 떠 있을 뿐입니다.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onEnter}
            disabled={!visible}
            className={`pointer-events-auto rounded-sm border border-[#c8d4e0]/40 bg-[#e8eef4]/10 px-6 py-3 font-sans text-sm tracking-wide text-[#eef3f7] backdrop-blur-sm transition hover:border-[#e8eef4]/70 hover:bg-[#e8eef4]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9eb8c8] ${
              visible ? "" : "pointer-events-none"
            }`}
          >
            우주로 들어가기
          </button>
          <span className="font-sans text-xs tracking-wider text-[#7a8a9a] uppercase">
            침묵의 공존 · MVP
          </span>
        </div>
      </div>
    </div>
  );
}
