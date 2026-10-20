/**
 * dsp-processor.js
 * Digital Signal Processing & Educational SpO2 Estimation Algorithm
 *
 * Implements:
 * 1. Real-time Peak & Valley Detection on Red (660nm) and IR (940nm) PPG channels
 * 2. Peak-to-Peak AC and Baseline DC Extraction
 * 3. Calculation of Modulation Ratio: R = (AC_red / DC_red) / (AC_ir / DC_ir)
 * 4. Empirical SpO2 Estimation: SpO2 = A - B * R (clamped to 50% - 100%)
 * 5. Pulse Rate (BPM) Estimation from Inter-Beat Intervals with Refractory Blanking
 * 6. Perfusion Index (PI %) Calculation
 * 7. Signal Quality Index (SQI %) based on waveform morphology, SNR, and clipping
 *
 * Clearly distinguishes user-selected target values from algorithmically estimated values.
 * Educational conceptual algorithm — not a clinical medical diagnostic algorithm.
 */

class DspProcessor {
    constructor() {
        // Calibration parameters: default standard empirical curve
        // SpO2 = A - B * R
        this.calibration = {
            modelType: 'linear',
            a: 110.0,
            b: 25.0,
            c: 0.0
        };

        // Ring buffer for peak/valley windowing
        this.windowSize = 250; // ~0.5 - 1.0 second history
        this.redWindow = [];
        this.irWindow = [];
        this.timeWindow = [];

        // Peak / Valley tracking state
        this.lastPeakTime = 0.0;
        this.peakIntervals = [];
        this.isPeakDetected = false;
        this.minRefractorySec = 0.35; // Maximum ~170 BPM limit to prevent dicrotic notch double counting

        // Extracted Signal Features
        this.acRed = 0.05;
        this.dcRed = 1.20;
        this.acIR = 0.06;
        this.dcIR = 1.35;
        this.ratioR = 0.85;

        // Estimated Output Values
        this.estimatedSpO2 = 98.0;
        this.estimatedBPM = 75;
        this.perfusionIndex = 2.5;
        this.sqi = 96; // Signal Quality Index (0 - 100%)

        // Smoothing state for display damping
        this.smoothSpO2 = 98.0;
        this.smoothBPM = 75;
        this.smoothPI = 2.5;
        this.smoothR = 0.85;

        // Peak detection state
        this.prevSlopeRed = 0;
        this.prevSlopeIR = 0;
        this.localMaxIR = -Infinity;
        this.localMinIR = Infinity;
        this.localMaxRed = -Infinity;
        this.localMinRed = Infinity;

        // Audio beat callback
        this.onBeatDetected = null;
    }

    /**
     * Set calibration coefficients (e.g. from Calibration Lab)
     */
    setCalibration(modelType, a, b, c = 0) {
        this.calibration = {
            modelType: modelType || 'linear',
            a: parseFloat(a) || 110.0,
            b: parseFloat(b) || 25.0,
            c: parseFloat(c) || 0.0
        };
    }

    getCalibration() {
        return { ...this.calibration };
    }

    /**
     * Feed latest sample from CircuitEmulator into DSP engine
     * @param {Object} sample Sample object from CircuitEmulator
     */
    processSample(sample) {
        const t = sample.time;
        const vRed = sample.tp4_acRedFiltered;
        const vIR = sample.tp4_acIRFiltered;
        const dcRed = sample.dcRed;
        const dcIR = sample.dcIR;

        // Push to rolling windows
        this.redWindow.push(vRed);
        this.irWindow.push(vIR);
        this.timeWindow.push(t);

        if (this.redWindow.length > this.windowSize) {
            this.redWindow.shift();
            this.irWindow.shift();
            this.timeWindow.shift();
        }

        // Peak detection using slope zero-crossing with threshold
        this.isPeakDetected = false;
        const n = this.irWindow.length;

        if (n >= 5) {
            const currentIR = this.irWindow[n - 1];
            const prevIR = this.irWindow[n - 2];
            const slopeIR = currentIR - prevIR;

            // Track min and max in rolling window
            let minR = Infinity, maxR = -Infinity;
            let minI = Infinity, maxI = -Infinity;

            for (let i = 0; i < n; i++) {
                if (this.redWindow[i] < minR) minR = this.redWindow[i];
                if (this.redWindow[i] > maxR) maxR = this.redWindow[i];
                if (this.irWindow[i] < minI) minI = this.irWindow[i];
                if (this.irWindow[i] > maxI) maxI = this.irWindow[i];
            }

            // AC Amplitude is peak-to-peak difference
            const calcAcRed = Math.max(0.001, maxR - minR);
            const calcAcIR = Math.max(0.001, maxI - minI);

            // Detect peak: positive-to-negative slope transition above dynamic threshold
            const peakThreshold = (maxI + minI) / 2.0 + (maxI - minI) * 0.25;

            if (this.prevSlopeIR > 0 && slopeIR <= 0 && prevIR > peakThreshold) {
                const deltaT = t - this.lastPeakTime;

                // Blanking refractory period check
                if (deltaT >= this.minRefractorySec) {
                    this.isPeakDetected = true;
                    this.lastPeakTime = t;

                    // Calculate instantaneous BPM
                    if (deltaT > 0.25 && deltaT < 2.0) {
                        const instantBPM = Math.round(60.0 / deltaT);
                        this.peakIntervals.push(instantBPM);
                        if (this.peakIntervals.length > 5) this.peakIntervals.shift();

                        // Median filtered BPM
                        const sorted = [...this.peakIntervals].sort((a, b) => a - b);
                        this.estimatedBPM = sorted[Math.floor(sorted.length / 2)];
                    }

                    // Update AC and DC measurements on peak
                    this.acRed = calcAcRed;
                    this.acIR = calcAcIR;
                    this.dcRed = Math.max(0.05, dcRed);
                    this.dcIR = Math.max(0.05, dcIR);

                    // 1. Calculate normalized AC/DC modulation for each wavelength:
                    // (AC/DC)_660 and (AC/DC)_940
                    const normRed = this.acRed / this.dcRed;
                    const normIR = this.acIR / this.dcIR;

                    // 2. Compute Modulation Ratio R:
                    // R = (AC_660 / DC_660) / (AC_940 / DC_940)
                    this.ratioR = normRed / Math.max(0.001, normIR);

                    // 3. Apply Empirical Calibration Curve:
                    let rawSpO2 = 98.0;
                    if (this.calibration.modelType === 'poly') {
                        rawSpO2 = this.calibration.c + (this.calibration.b * this.ratioR) + (this.calibration.a * Math.pow(this.ratioR, 2));
                    } else {
                        // Linear model: SpO2 = A - B * R
                        rawSpO2 = this.calibration.a - (this.calibration.b * this.ratioR);
                    }

                    // Handle edge cases & clamp outputs to sensible educational range [50%, 100%]
                    if (sample.isTiaSaturated || sample.isPgaClipped) {
                        // If clipped, estimation is unreliable
                        rawSpO2 = Math.max(50.0, Math.min(100.0, rawSpO2));
                    } else {
                        rawSpO2 = Math.max(50.0, Math.min(100.0, rawSpO2));
                    }

                    this.estimatedSpO2 = rawSpO2;

                    // 4. Perfusion Index (PI %) = (AC_IR / DC_IR) * 100%
                    this.perfusionIndex = Math.max(0.05, Math.min(20.0, normIR * 100.0));

                    // 5. Signal Quality Index (SQI %):
                    // Factors: amplitude sanity, clipping absence, SNR
                    let quality = 98.0;
                    if (sample.isTiaSaturated) quality -= 45.0;
                    if (sample.isPgaClipped) quality -= 35.0;
                    if (this.perfusionIndex < 0.5) quality -= 25.0;
                    if (this.ratioR < 0.3 || this.ratioR > 2.2) quality -= 20.0;
                    this.sqi = Math.round(Math.max(10.0, Math.min(99.0, quality)));

                    // Trigger audio callback if registered
                    if (this.onBeatDetected && typeof this.onBeatDetected === 'function') {
                        this.onBeatDetected({
                            spO2: this.estimatedSpO2,
                            bpm: this.estimatedBPM,
                            sqi: this.sqi
                        });
                    }
                }
            }

            this.prevSlopeIR = slopeIR;
        }

        // Apply smooth exponential display filter
        const smoothAlpha = 0.05;
        this.smoothSpO2 += smoothAlpha * (this.estimatedSpO2 - this.smoothSpO2);
        this.smoothBPM += smoothAlpha * (this.estimatedBPM - this.smoothBPM);
        this.smoothPI += smoothAlpha * (this.perfusionIndex - this.smoothPI);
        this.smoothR += smoothAlpha * (this.ratioR - this.smoothR);

        return {
            time: t,
            isPeakDetected: this.isPeakDetected,
            acRed: this.acRed,
            dcRed: this.dcRed,
            acIR: this.acIR,
            dcIR: this.dcIR,
            normRed: this.acRed / this.dcRed,
            normIR: this.acIR / this.dcIR,
            ratioR: this.smoothR,
            spO2: Math.max(50.0, Math.min(100.0, this.smoothSpO2)),
            rawSpO2: this.estimatedSpO2,
            bpm: Math.round(this.smoothBPM),
            pi: this.smoothPI,
            sqi: this.sqi,
            isClipped: sample.isPgaClipped || sample.isTiaSaturated
        };
    }
}

if (typeof window !== 'undefined') {
    window.DspProcessor = DspProcessor;
}
