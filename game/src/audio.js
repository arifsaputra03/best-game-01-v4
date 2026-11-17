// WebAudio synth: every sound is a few oscillators, no audio files.
// A quiet ambient pad loops under the game; effects answer each action.
export function makeAudio() {
  let ctx = null;
  let muted = false;
  let padNodes = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  const sfx = (name) => {
    if (muted) return;
    switch (name) {
      case 'swing': tone(220, 0.08, 'triangle', 0.06, 140); break;
      case 'slash': noise(0.12, 0.12, 2400); tone(320, 0.1, 'sawtooth', 0.05, 90); break;
      case 'fire': tone(180, 0.25, 'sawtooth', 0.08, 60); noise(0.2, 0.06, 900); break;
      case 'bow': tone(600, 0.07, 'triangle', 0.07, 900); break;
      case 'dash': noise(0.15, 0.08, 3000); break;
      case 'coin': tone(880, 0.08, 'sine', 0.08); setTimeout(() => tone(1320, 0.1, 'sine', 0.07), 60); break;
      case 'potion': tone(420, 0.2, 'sine', 0.09, 840); break;
      case 'chest': tone(523, 0.12, 'triangle', 0.09); setTimeout(() => tone(784, 0.16, 'triangle', 0.09), 100); break;
      case 'bash': noise(0.25, 0.16, 800); tone(90, 0.25, 'sine', 0.16, 40); break;
      case 'nova': tone(140, 0.5, 'sawtooth', 0.1, 700); noise(0.4, 0.08, 600); break;
      case 'volley': tone(700, 0.1, 'triangle', 0.06, 1200); break;
      case 'boss': tone(70, 0.6, 'sawtooth', 0.12, 45); break;
      case 'shop': tone(660, 0.1, 'sine', 0.08); setTimeout(() => tone(880, 0.12, 'sine', 0.08), 90); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.1), i * 130)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.09), i * 160)); break;
      case 'levelup': [440, 554, 659, 880].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'sine', 0.09), i * 80)); break;
      default: break;
    }
  };

  function startPad() {
    const c = ensure();
    if (!c || padNodes) return;
    const g = c.createGain();
    g.gain.value = 0.035;
    g.connect(c.destination);
    const oscs = [55, 82.5, 110.3].map((f, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start();
      return o;
    });
    padNodes = { g, oscs };
  }
  function setMuted(m) { muted = m; if (padNodes) padNodes.g.gain.value = m ? 0 : 0.035; }
  function unlock() { ensure(); startPad(); }

  return { sfx, setMuted, unlock, isMuted: () => muted };
}
