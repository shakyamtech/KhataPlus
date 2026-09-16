export type BarcodeSoundType = "sweet_ding" | "sweet_bell" | "classic_beep" | "supermarket_chime" | "mute";

export const BARCODE_SOUND_OPTIONS: { id: BarcodeSoundType; name: string; desc: string }[] = [
  { id: "sweet_ding", name: "🎵 मिठो डिङ (Sweet Ding)", desc: "०.७ सेकेन्डको लामो र सुमधुर चाइम (Resonant 2-tone chime)" },
  { id: "sweet_bell", name: "🔔 मीठो घण्टी (Sweet Bell)", desc: "०.८५ सेकेन्डको क्याश रजिष्टर घण्टी (Cash register bell)" },
  { id: "supermarket_chime", name: "🛒 सुपरमार्केट चाइम (Supermarket Chime)", desc: "०.६५ सेकेन्डको सुपरमार्केट ३-टोन पीओएस साउन्ड" },
  { id: "classic_beep", name: "⚡ क्लासिक बीप (Classic Beep)", desc: "०.४ सेकेन्डको तिखो र स्पष्ट बीप (Clear scanner beep)" },
  { id: "mute", name: "🔇 मौन (Silent / Mute)", desc: "कुनै आवाज नआउने (आवाज विहीन)" },
];

export const getSavedBarcodeSound = (): BarcodeSoundType => {
  if (typeof window === "undefined") return "sweet_ding";
  const saved = localStorage.getItem("khataplus_barcode_scan_sound");
  if (saved && ["sweet_ding", "sweet_bell", "classic_beep", "supermarket_chime", "mute"].includes(saved)) {
    return saved as BarcodeSoundType;
  }
  return "sweet_ding";
};

// Singleton Web Audio Context to prevent mobile AudioContext quotas/limits
let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
};

export const playScanBeep = (typeOverride?: BarcodeSoundType) => {
  const soundType = typeOverride || getSavedBarcodeSound();
  if (soundType === "mute") return;

  const audioCtx = getAudioContext();
  if (!audioCtx) return;

  try {
    if (soundType === "sweet_ding") {
      // Sweet Ding: Resonant 2-note melody (D5 -> A5) with long warm decay (~0.7s)
      const now = audioCtx.currentTime;
      const osc1 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880.00, now + 0.12); // A5

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.75);

      osc1.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.75);
    } else if (soundType === "sweet_bell") {
      // Sweet Bell: Metallic brass bell chord (C5 + E5 + G5 + C6) with long ring decay (~0.85s)
      const now = audioCtx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      const gain = audioCtx.createGain();

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.85);

      freqs.forEach((freq) => {
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.85);
      });

      gain.connect(audioCtx.destination);
    } else if (soundType === "supermarket_chime") {
      // Supermarket Chime: 3-step ascending POS chime (G5 -> C6 -> E6) (~0.65s)
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.08); // C6
      osc.frequency.setValueAtTime(1318.51, now + 0.16); // E6

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.65);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } else {
      // Classic Beep: Clear single scanner beep (~0.4s)
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch {
    // Muted/blocked audio
  }
};
