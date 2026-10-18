/// Som quando a Luna responde. Os cinco sons são sintetizados com Web Audio, sem arquivos de áudio.
export const SOUND_KEY = "luna.sound";
export const SOUND_OFF = "off";

export const SOUNDS = [
  { id: "sino", label: "Sino" },
  { id: "gota", label: "Gota" },
  { id: "lua", label: "Lua" },
  { id: "miau", label: "Miau" },
  { id: "pop", label: "Pop" },
] as const;

export type SoundId = (typeof SOUNDS)[number]["id"];
export type SoundChoice = SoundId | typeof SOUND_OFF;

/// Padrão: o sino. "off" guarda o desligado.
export function loadSound(): SoundChoice {
  try {
    const saved = localStorage.getItem(SOUND_KEY);
    if (saved === SOUND_OFF || SOUNDS.some((s) => s.id === saved)) return saved as SoundChoice;
  } catch {
    // Armazenamento indisponível: usa o padrão.
  }
  return "sino";
}

export function saveSound(choice: SoundChoice) {
  try {
    localStorage.setItem(SOUND_KEY, choice);
  } catch {
    // Sem armazenamento, a escolha vale só nesta sessão.
  }
}

/// Uma nota: frequência em Hz (com glissando até `endFreq`, se houver), início e duração em segundos.
interface Note {
  freq: number;
  endFreq?: number;
  at: number;
  dur: number;
  type: OscillatorType;
  gain: number;
}

const RECIPES: Record<SoundId, Note[]> = {
  // Duas notas de sino, a segunda mais aguda e mais curta.
  sino: [
    { freq: 880, at: 0, dur: 0.9, type: "sine", gain: 0.25 },
    { freq: 1320, at: 0.02, dur: 0.6, type: "sine", gain: 0.1 },
  ],
  // Um tom que cai, como uma gota batendo.
  gota: [{ freq: 1400, endFreq: 500, at: 0, dur: 0.25, type: "sine", gain: 0.3 }],
  // Acorde curto e brilhante, subindo.
  lua: [
    { freq: 523, at: 0, dur: 0.5, type: "triangle", gain: 0.15 },
    { freq: 659, at: 0.08, dur: 0.5, type: "triangle", gain: 0.15 },
    { freq: 784, at: 0.16, dur: 0.6, type: "triangle", gain: 0.15 },
  ],
  // Miado: a frequência sobe e desce, como o gatinho.
  miau: [
    { freq: 600, endFreq: 1100, at: 0, dur: 0.2, type: "triangle", gain: 0.2 },
    { freq: 1100, endFreq: 500, at: 0.2, dur: 0.35, type: "triangle", gain: 0.2 },
  ],
  // Estalo curto e seco.
  pop: [{ freq: 700, endFreq: 200, at: 0, dur: 0.06, type: "sine", gain: 0.35 }],
};

/// Toca o som escolhido. Sem Web Audio (ambiente de teste), não faz nada.
export function playSound(id: SoundId): void {
  const Context = window.AudioContext;
  if (!Context) return;
  const ctx = new Context();
  const start = ctx.currentTime;
  let length = 0;
  for (const note of RECIPES[id]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type;
    osc.frequency.setValueAtTime(note.freq, start + note.at);
    if (note.endFreq) osc.frequency.exponentialRampToValueAtTime(note.endFreq, start + note.at + note.dur);
    gain.gain.setValueAtTime(0.0001, start + note.at);
    gain.gain.exponentialRampToValueAtTime(note.gain, start + note.at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start + note.at);
    osc.stop(start + note.at + note.dur);
    length = Math.max(length, note.at + note.dur);
  }
  // Cada som tem o próprio contexto; ele é fechado quando o som acaba.
  setTimeout(() => void ctx.close(), (length + 0.2) * 1000);
}

/// Toca o som da resposta, se o usuário não tiver desligado.
export function playReplySound(): void {
  const choice = loadSound();
  if (choice !== SOUND_OFF) playSound(choice);
}
