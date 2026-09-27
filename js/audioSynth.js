// ==========================================================================
// Web Audio Stethoscope & Acoustic Telemetry Synthesizer
// Generates realistic S1/S2 heart sounds, pulmonary breath sounds, and HUD chimes
// ==========================================================================

class AudioStethoscopeSynth {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.bpm = 75;
        this.heartTimer = null;
        this.breathTimer = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.startHeartLoop();
    }

    playS1(time) {
        if (!this.ctx || !this.enabled) return;
        // S1 (Mitral/Tricuspid closure) - Low frequency thump (~45-55 Hz)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(52, time);
        osc.frequency.exponentialRampToValueAtTime(32, time + 0.08);

        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.12);
    }

    playS2(time) {
        if (!this.ctx || !this.enabled) return;
        // S2 (Aortic/Pulmonary closure) - Slightly higher, snappier (~70-85 Hz)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(78, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.06);

        gain.gain.setValueAtTime(0.28, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.09);
    }

    startHeartLoop() {
        if (this.heartTimer) clearInterval(this.heartTimer);
        const intervalMs = (60 / this.bpm) * 1000;

        this.heartTimer = setInterval(() => {
            if (!this.ctx || !this.enabled) return;
            const now = this.ctx.currentTime;
            this.playS1(now);
            // S2 occurs approximately 0.28-0.34s after S1 in typical cardiac cycle
            this.playS2(now + 0.30);
        }, intervalMs);
    }

    setBPM(bpm) {
        this.bpm = bpm;
        this.startHeartLoop();
    }

    playChime() {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15); // A6
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
    }

    toggleAudio() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

window.StethoscopeAudio = new AudioStethoscopeSynth();
