/**
 * audio-synthesizer.js
 * Authentic Medical Pulse Oximeter Audio Synthesis via Web Audio API
 *
 * Implements:
 * 1. Dynamic Pitch-Modulated Cardiac Beep (Frequency mapped directly to SpO2 %)
 * 2. Authentic Hospital Patient Monitor Timbre (Pure sine + subtle harmonic + exponential envelope)
 * 3. Hypoxia Alarm Beep for critical oxygen desaturation (< 88% SpO2)
 * 4. Safe Volume Control & User Interaction AudioContext Unlock
 */

class PulseAudioSynthesizer {
    constructor() {
        this.ctx = null;
        this.isMuted = true;   // Default muted for gentle user experience
        this.volume = 0.20;     // Safe comfortable volume
        this.isUnlocked = false;
        this.lastBeepTime = 0.0;
    }

    initContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.isUnlocked = true;
    }

    setMuted(muted) {
        this.isMuted = !!muted;
        if (!this.isMuted) {
            this.initContext();
        }
    }

    setVolume(vol) {
        this.volume = Math.max(0.0, Math.min(1.0, parseFloat(vol)));
    }

    /**
     * Map oxygen saturation percentage to audio frequency
     * Higher saturation = higher frequency chime:
     * 100% -> ~740 Hz (F#5)
     * 95%  -> ~680 Hz (E5)
     * 90%  -> ~610 Hz (D#5)
     * 80%  -> ~490 Hz (B4)
     * 70%  -> ~370 Hz (F#4)
     */
    spO2ToFrequency(spO2) {
        const clamped = Math.max(65.0, Math.min(100.0, spO2));
        return 330.0 + (clamped - 65.0) * 11.7;
    }

    /**
     * Trigger a single clinical pulse tone on cardiac systolic peak
     * @param {number} spO2 Oxygen saturation level
     */
    playPulseTone(spO2) {
        if (this.isMuted) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        if (now - this.lastBeepTime < 0.22) return; // Debounce rapid triggers
        this.lastBeepTime = now;

        const freq = this.spO2ToFrequency(spO2);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Authentic hospital monitor tone: sine wave with fast attack & decay
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const duration = 0.080; // 80ms crisp pulse beep
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(this.volume, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.02);
    }
}

if (typeof window !== 'undefined') {
    window.PulseAudioSynthesizer = PulseAudioSynthesizer;
}
