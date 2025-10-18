// Simple SoundManager to centralize audio logic and avoid iOS first-play jank.
(function () {
  const soundFiles = {
    pop1: "sounds/pop1.mp3",
    pop2: "sounds/pop2.mp3",
    pop3: "sounds/pop3.mp3",
    miss: "sounds/miss.mp3",
    merge: "sounds/merge.mp3",
    end: "sounds/end.mp3",
    start: "sounds/start.mp3",
  };

  const legacyAudios = {};
  let audioCtx = null;
  let masterGain = null;
  const audioBuffers = {};
  const silentKeepAlive = { source: null, gain: null };

  const SoundManager = {
    soundMuted: false,

    initUI() {
      const soundIcon = document.getElementById("sound-icon");
      if (!soundIcon) return;
      if (this.soundMuted) {
        soundIcon.src = "mute.svg";
        soundIcon.alt = "Sound Muted";
      } else {
        soundIcon.src =
          "data:image/svg+xml;base64," +
          btoa(
            '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>'
          );
        soundIcon.alt = "Sound On";
      }
      const soundBtn = document.getElementById("sound-toggle");
      if (soundBtn) soundBtn.classList.toggle("muted", this.soundMuted);
    },

    preloadSounds() {
      if (window.AudioContext || window.webkitAudioContext) {
        try {
          if (!audioCtx)
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          masterGain = audioCtx.createGain();
          masterGain.connect(audioCtx.destination);

          const decodePromises = Object.keys(soundFiles).map((key) => {
            return fetch(soundFiles[key])
              .then((r) => r.arrayBuffer())
              .then((arr) => audioCtx.decodeAudioData(arr))
              .then((buf) => {
                audioBuffers[key] = buf;
              })
              .catch((e) => {
                console.warn("WebAudio decode failed for", key, e);
                legacyAudios[key] = new Audio(soundFiles[key]);
              });
          });

          return Promise.allSettled(decodePromises).then(() => {
            Object.keys(soundFiles).forEach((k) => {
              if (!audioBuffers[k] && !legacyAudios[k]) {
                legacyAudios[k] = new Audio(soundFiles[k]);
              }
            });
            // Sync UI after preload
            this.initUI();
          });
        } catch (e) {
          console.warn("WebAudio init failed:", e);
          Object.keys(soundFiles).forEach((k) => (legacyAudios[k] = new Audio(soundFiles[k])));
        }
      } else {
        Object.keys(soundFiles).forEach((k) => (legacyAudios[k] = new Audio(soundFiles[k])));
      }
      this.initUI();
      return Promise.resolve();
    },

    playSound(name) {
      if (this.soundMuted) return;
      try {
        if (audioCtx && audioBuffers[name]) {
          const src = audioCtx.createBufferSource();
          src.buffer = audioBuffers[name];
          const g = audioCtx.createGain();
          g.gain.value = 1;
          src.connect(g);
          g.connect(masterGain || audioCtx.destination);
          src.start(0);
        } else if (legacyAudios[name]) {
          legacyAudios[name].currentTime = 0;
          legacyAudios[name].play().catch(() => {});
        }
      } catch (e) {
        // Ignore playback errors
      }
    },

    toggleSound() {
      this.soundMuted = !this.soundMuted;
      const soundIcon = document.getElementById("sound-icon");
      if (soundIcon) {
        if (this.soundMuted) {
          soundIcon.src = "mute.svg";
          soundIcon.alt = "Sound Muted";
        } else {
          soundIcon.src =
            "data:image/svg+xml;base64," +
            btoa(
              '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>'
            );
          soundIcon.alt = "Sound On";
        }
      }
      const soundBtn = document.getElementById("sound-toggle");
      if (soundBtn) soundBtn.classList.toggle("muted", this.soundMuted);

      try {
        if (masterGain) masterGain.gain.value = this.soundMuted ? 0 : 1;
        Object.values(legacyAudios).forEach((a) => (a.muted = !!this.soundMuted));
      } catch (e) {}
    },

    unlockAudioIfNeeded() {
      if (!(window.AudioContext || window.webkitAudioContext)) return;
      if (!audioCtx) {
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          masterGain = audioCtx.createGain();
          masterGain.connect(audioCtx.destination);
        } catch (e) {
          return;
        }
      }

      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});

      if (!silentKeepAlive.source) {
        try {
          const buf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          const g = audioCtx.createGain();
          g.gain.value = 0.0001;
          src.connect(g);
          g.connect(masterGain || audioCtx.destination);
          src.start(0);
          silentKeepAlive.source = src;
          silentKeepAlive.gain = g;
        } catch (e) {}
      }
    },
  };

  // Expose to global scope
  window.SoundManager = SoundManager;
})();
