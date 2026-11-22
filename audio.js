/* 大脑巴士 · 声音引擎
   全部用 WebAudio 现场合成，不加载任何音频文件：
   - 音效：点击、上车、完成、发车、收车、报错
   - 音乐：四个阶段各一条轻量循环（评估 / 站台 / 旅程 / 记录）
   首次点击屏幕后才会出声（浏览器自动播放策略），设置存在 localStorage。 */
const Sound = (() => {
  const KEY = 'brain-bus-sound';
  const LEVEL_KEY = 'brain-bus-music-vol'; // 换了量纲，换键名避免旧值误读
  const MAX_GAIN = 0.55; // 滑块拉满时的音乐总线增益
  let on = true;
  let volume = 60;      // 0–100
  try {
    if (localStorage.getItem(KEY) === 'off') on = false;
    const raw = localStorage.getItem(LEVEL_KEY);
    const saved = raw === null ? NaN : Number(raw);
    if (Number.isFinite(saved) && saved >= 0 && saved <= 100) volume = saved;
  } catch {}

  let ctx = null;
  let master = null;
  let musicBus = null;
  let musicFilter = null;
  let sfxBus = null;
  let stage = null;
  let timer = null;
  let step = 0;
  let nextAt = 0;
  let played = 0;

  // C 大调五声音阶，音高表（Hz）
  const N = {
    F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
    C6: 1046.5, E6: 1318.5, G6: 1568.0
  };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = on ? 1 : 0;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = volume / 100 * MAX_GAIN;
    // 低通掉高频毛刺，听感更柔和、不扎耳朵
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 2600;
    musicBus.connect(musicFilter).connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.42;
    sfxBus.connect(master);
    return ctx;
  }

  function tone(freq, at, dur, {type = 'square', gain = 0.3, bus = sfxBus, glide = 0} = {}) {
    if (!freq) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * glide), at + dur);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.02, dur * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env).connect(bus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  function noise(at, dur, {gain = 0.2, hp = 1200, bus = sfxBus} = {}) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const env = ctx.createGain();
    env.gain.value = gain;
    src.connect(filter).connect(env).connect(bus);
    src.start(at);
  }

  // ---------- 音效 ----------
  const SFX = {
    tap: t => tone(N.E6, t, 0.05, {type: 'square', gain: 0.10}),
    nav: t => {
      tone(N.G5, t, 0.07, {type: 'triangle', gain: 0.16});
      tone(N.C6, t + 0.06, 0.09, {type: 'triangle', gain: 0.14});
    },
    pop: t => {
      tone(N.E5, t, 0.09, {type: 'sine', gain: 0.28});
      tone(N.A5, t + 0.07, 0.1, {type: 'sine', gain: 0.22});
    },
    board: t => {
      tone(N.C5, t, 0.09, {type: 'square', gain: 0.16});
      tone(N.G5, t + 0.08, 0.12, {type: 'square', gain: 0.14});
    },
    done: t => {
      tone(N.A5, t, 0.1, {type: 'triangle', gain: 0.3});
      tone(N.C6, t + 0.08, 0.14, {type: 'triangle', gain: 0.26});
      noise(t, 0.12, {gain: 0.05, hp: 4000});
    },
    depart: t => {
      tone(N.C3, t, 0.5, {type: 'sawtooth', gain: 0.16, glide: 1.6});
      noise(t, 0.45, {gain: 0.08, hp: 600});
      tone(N.G4, t + 0.28, 0.16, {type: 'square', gain: 0.12});
    },
    arrive: t => {
      [N.C5, N.E5, N.G5].forEach((f, i) => tone(f, t + i * 0.09, 0.18, {type: 'triangle', gain: 0.22}));
    },
    end: t => {
      [N.G4, N.C5, N.E5, N.G5].forEach((f, i) => tone(f, t + i * 0.11, 0.26, {type: 'square', gain: 0.16}));
      noise(t, 0.3, {gain: 0.05, hp: 3000});
    },
    error: t => {
      tone(190, t, 0.11, {type: 'square', gain: 0.2});
      tone(150, t + 0.12, 0.16, {type: 'square', gain: 0.16});
    },
    toggle: t => {
      tone(N.A4, t, 0.07, {type: 'square', gain: 0.2});
      tone(N.E5, t + 0.06, 0.1, {type: 'square', gain: 0.18});
    }
  };

  function play(name) {
    if (!on || !ensure()) return;
    played++;
    if (ctx.state === 'suspended') ctx.resume();
    const fn = SFX[name];
    if (fn) fn(ctx.currentTime + 0.001);
  }

  // ---------- 音乐 ----------
  // 每条轨道：bpm + 每拍要触发的内容
  // 和弦：每个进行 4 个和弦，每个和弦持续一小节
  const CHORDS = {
    C: {bass: 'C3', tones: ['C4', 'E4', 'G4']},
    Am: {bass: 'A2', tones: ['A3', 'C4', 'E4']},
    F: {bass: 'F2', tones: ['F3', 'A3', 'C4']},
    G: {bass: 'G2', tones: ['G3', 'B3', 'D4']},
    Em: {bass: 'E3', tones: ['E3', 'G3', 'B3']}
  };

  // 每条轨道 12 小节起步：前 6 小节只有琶音和低音，后 6 小节旋律进来，形成一次「展开」
  const TRACKS = {
    assess: {
      bpm: 74, prog: ['C', 'Am', 'F', 'G'], bars: 12,
      arp: [0, 1, 2, 1, 0, 2, 1, 2], every: 2,
      melody: [null, null, 2, null, null, 1, null, null],
      hat: null, kick: false
    },
    station: {
      bpm: 96, prog: ['C', 'Am', 'F', 'G'], bars: 12,
      arp: [0, 2, 1, 2, 0, 1, 2, 1], every: 2,
      melody: [null, 2, null, null, 1, null, null, 2],
      hat: 'soft', kick: false
    },
    run: {
      bpm: 122, prog: ['C', 'G', 'Am', 'F'], bars: 12,
      arp: [0, 1, 2, 3, 2, 1, 0, 1], every: 1,
      melody: [2, null, 1, null, 2, null, null, 1],
      hat: 'tight', kick: true
    },
    me: {
      bpm: 70, prog: ['C', 'F', 'Am', 'G'], bars: 12,
      arp: [0, 2, 1, 2, 0, 2, 1, 2], every: 2,
      melody: [null, null, null, 1, null, null, 2, null],
      hat: null, kick: false
    }
  };

  function schedule() {
    if (!ctx || !on || !stage) return;
    const track = TRACKS[stage];
    if (!track) return;
    const stepDur = 60 / track.bpm / 2; // 八分音符
    while (nextAt < ctx.currentTime + 0.15) {
      const time = nextAt;
      const inBar = step % 8;
      const bar = Math.floor(step / 8) % track.bars;
      const chord = CHORDS[track.prog[bar % track.prog.length]];
      const half = bar >= track.bars / 2; // 后半段旋律进来

      // 琶音
      if (inBar % (track.every || 1) === 0) {
        const tone = chord.tones[track.arp[inBar] % chord.tones.length];
        tone && playNote(tone, time, stepDur * 2.2, 0.07);
      }

      // 旋律（高八度，只走后半段）
      if (half && track.melody && track.melody[inBar] !== null && track.melody[inBar] !== undefined) {
        const tone = chord.tones[track.melody[inBar] % chord.tones.length];
        tone && playNote(tone, time, stepDur * 4, 0.075, true);
      }

      // 低音：每小节第 1、3 拍
      if (inBar === 0 || inBar === 4) {
        tone(N[chord.bass], time, stepDur * 3.2, {type: 'sine', gain: 0.13, bus: musicBus});
      }

      // 轻打击
      if (track.hat === 'soft' && inBar === 4) noise(time, 0.035, {gain: 0.014, hp: 7200, bus: musicBus});
      if (track.hat === 'tight' && inBar % 2 === 0) noise(time, 0.03, {gain: 0.016, hp: 7600, bus: musicBus});
      if (track.kick && inBar === 0) tone(104, time, 0.1, {type: 'sine', gain: 0.15, glide: 0.7, bus: musicBus});

      nextAt += stepDur;
      step++;
    }
  }

  // 音乐用的音符：默认音量低、衰减自然
  function playNote(name, at, dur, gain, octaveUp = false) {
    const freq = N[name];
    if (!freq) return;
    tone(octaveUp ? freq * 2 : freq, at, dur, {type: 'triangle', gain, bus: musicBus});
  }

  function startMusic() {
    if (!ctx || timer) return;
    nextAt = ctx.currentTime + 0.05;
    step = 0;
    timer = setInterval(schedule, 40);
    schedule();
  }

  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function setStage(name) {
    if (stage === name) return;
    stage = name;
    step = 0;
    if (ctx) nextAt = ctx.currentTime + 0.05;
  }

  function setEnabled(next) {
    on = !!next;
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {}
    if (ensure()) {
      master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02);
      if (on) {
        if (ctx.state === 'suspended') ctx.resume();
        startMusic();
      } else {
        stopMusic();
      }
    }
    return on;
  }

  function setMusicVolume(next) {
    volume = Math.max(0, Math.min(100, Math.round(next)));
    try {
      localStorage.setItem(LEVEL_KEY, String(volume));
    } catch {}
    if (ensure()) {
      musicBus.gain.setTargetAtTime(volume / 100 * MAX_GAIN, ctx.currentTime, 0.05);
    }
    return volume;
  }

  function toggle() {
    const next = setEnabled(!on);
    if (next) play('toggle');
    return next;
  }

  // 首次交互解锁（iOS / Safari 要求用户手势）
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (on) startMusic();
  }
  window.addEventListener('pointerdown', unlock, {once: true});
  window.addEventListener('keydown', unlock, {once: true});
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      stopMusic();
      // 隐藏时彻底挂起音频通道：只是停音乐的话上下文还挂在系统输出流上，
      // 电脑会一直以为在放声音（挡休眠、排查时也难找到源头）
      if (ctx.state === 'running') ctx.suspend();
    } else {
      if (on) startMusic();
      if (ctx.state === 'suspended') ctx.resume();
    }
  });

  return {
    play,
    setStage,
    toggle,
    // 调试用：确认音频上下文和调度器状态
    setMusicVolume,
    get musicVolume() {
      return volume;
    },
    get debug() {
      return {created: !!ctx, state: ctx ? ctx.state : null, music: !!timer, stage, played, volume};
    },
    get enabled() {
      return on;
    }
  };
})();
