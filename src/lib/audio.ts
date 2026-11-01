import { AUDIO } from "./constants";

type AudioPrefs = {
  musicOn: boolean;
  sfxOn: boolean;
};

const PREF_KEY = "space-lounge-audio";

function loadPrefs(): AudioPrefs {
  if (typeof window === "undefined") return { musicOn: true, sfxOn: true };
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { musicOn: true, sfxOn: true };
    return { musicOn: true, sfxOn: true, ...JSON.parse(raw) };
  } catch {
    return { musicOn: true, sfxOn: true };
  }
}

function savePrefs(p: AudioPrefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** Lightweight audio bus — starts only after user gesture (enter). */
class LoungeAudioBus {
  private bgm: HTMLAudioElement | null = null;
  private prefs = loadPrefs();
  private started = false;

  get musicOn() {
    return this.prefs.musicOn;
  }

  get sfxOn() {
    return this.prefs.sfxOn;
  }

  /** Call from a click handler to unlock autoplay. */
  async unlockAndStart() {
    if (typeof window === "undefined") return;
    if (!this.bgm) {
      this.bgm = new Audio(AUDIO.bgm);
      this.bgm.loop = true;
      this.bgm.volume = 0.36;
      this.bgm.preload = "auto";
    } else if (!this.bgm.src.includes("deep-space-ambience")) {
      // Prefer the looped deep-space MP3 over any prior synthetic ambient.
      this.bgm.src = AUDIO.bgm;
      this.bgm.loop = true;
    }
    this.started = true;
    await this.syncBgm();
  }

  private async syncBgm() {
    if (!this.bgm || !this.started) return;
    if (this.prefs.musicOn) {
      try {
        await this.bgm.play();
      } catch {
        /* autoplay still blocked — user can toggle again */
      }
    } else {
      this.bgm.pause();
    }
  }

  setMusicOn(on: boolean) {
    this.prefs.musicOn = on;
    savePrefs(this.prefs);
    void this.syncBgm();
  }

  setSfxOn(on: boolean) {
    this.prefs.sfxOn = on;
    savePrefs(this.prefs);
  }

  playSfx(kind: "wave" | "heart") {
    if (!this.prefs.sfxOn || typeof window === "undefined") return;
    const src = kind === "wave" ? AUDIO.wave : AUDIO.heart;
    const el = new Audio(src);
    el.volume = kind === "heart" ? 0.38 : 0.42;
    void el.play().catch(() => {});
  }
}

export const loungeAudio = new LoungeAudioBus();
