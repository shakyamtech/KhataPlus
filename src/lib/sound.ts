export type BarcodeSoundType = "sweet_ding" | "sweet_bell" | "classic_beep" | "supermarket_chime" | "mute";

export const BARCODE_SOUND_OPTIONS: { id: BarcodeSoundType; name: string; desc: string }[] = [
  { id: "sweet_ding", name: "🎵 मिठो डिङ (Sweet Ding)", desc: "नरम र सुमधुर डबल चाइम (Smooth 2-tone chime)" },
  { id: "sweet_bell", name: "🔔 मीठो घण्टी (Sweet Bell)", desc: "कैश रजिष्टर तथा बेल साउन्ड (Cash register bell)" },
  { id: "classic_beep", name: "⚡ क्लासिक बीप (Classic Beep)", desc: "हाई-पिच स्ट्यान्डर्ड बीप साउन्ड (Standard scanner beep)" },
  { id: "supermarket_chime", name: "🛒 सुपरमार्केट चाइम (Supermarket Chime)", desc: "सुपरमार्केट पीओएस डबल-ट्याप साउन्ड" },
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

export const playScanBeep = (typeOverride?: BarcodeSoundType) => {
  const soundType = typeOverride || getSavedBarcodeSound();
  if (soundType === "mute") return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();

    if (soundType === "sweet_ding") {
      // Sweet Ding: Pleasant 2-tone ascending chime (E5 -> B5)
      const now = audioCtx.currentTime;
      const osc1 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now); // E5 (659Hz)
      osc1.frequency.setValueAtTime(987.77, now + 0.07); // B5 (987Hz)

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc1.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.22);
    } else if (soundType === "sweet_bell") {
      // Sweet Bell: Metallic harmonic bell chord (E6 + G#6 + B6)
      const now = audioCtx.currentTime;
      const freqs = [1318.5, 1661.2, 1975.5];
      const gain = audioCtx.createGain();

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      freqs.forEach((freq) => {
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.32);
      });

      gain.connect(audioCtx.destination);
    } else if (soundType === "supermarket_chime") {
      // Supermarket Chime: High double tap (1760Hz -> 2093Hz)
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, now);
      osc.frequency.setValueAtTime(2093, now + 0.05);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } else {
      // Classic Beep: Crisp single scanner beep (1046.5Hz)
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch {
    // Muted/blocked audio
  }
};
