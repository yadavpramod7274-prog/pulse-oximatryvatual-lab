/**
 * circuit-emulator.js
 * Block-Level Electronic Circuit Emulation for Pulse Oximetry
 *
 * Implements:
 * 1. LED Driver & Timing Multiplexer (660nm Red & 940nm IR Channels)
 * 2. Silicon PIN Photodiode & Transimpedance Amplifier (TIA) with Op-Amp Rails
 * 3. Synchronous Demultiplexer & Ambient Light Subtraction
 * 4. Active Bandpass Filtering (HPF DC-Block + LPF Anti-Aliasing)
 * 5. Programmable Gain Amplifier (PGA)
 * 6. Analog-to-Digital Converter (ADC) Discretization & Sampling Discretization
 * 7. Comprehensive Test Point (TP1 to TP5) Probing
 *
 * Educational conceptual model — not for clinical or real-world hardware production.
 */

class CircuitEmulator {
    constructor() {
        // User-Adjustable Circuit Parameters
        this.params = {
            // LED Channels
            ledCurrentRed: 20.0,       // mA (5.0 - 50.0 mA)
            ledCurrentIR: 20.0,        // mA (5.0 - 50.0 mA)
            
            // Photodetector & Pre-amp
            rfTIA: 220.0,              // kOhm (50 - 1000 kOhm)
            cfTIA: 47.0,               // pF (stability capacitor)
            
            // Amplifier Gain
            pgaGain: 35.0,             // V/V (1 - 100)
            
            // Noise & Interference
            noiseLevel: 0.05,          // 0.0 to 1.0 (thermal & EMI noise)
            ambientLux: 40.0,          // lux (0 - 100 lux ambient stray light)
            ambientCancelEnabled: true,// Synchronous ambient subtraction toggle
            mainsHumFreq: 50,          // 50 Hz or 60 Hz flicker
            
            // ADC & Sampling
            adcBits: 12,               // 8, 10, 12, or 16-bit resolution
            samplingRate: 500,         // 50, 100, 250, 500, or 1000 Hz
            
            // Filter Cutoffs
            hpfCutoff: 0.5,            // Hz (High-pass filter DC block)
            lpfCutoff: 8.0             // Hz (Low-pass filter anti-aliasing)
        };

        // Op-Amp Physical Power Rails
        this.vSupplyPos = 3.3;        // +3.3V DC
        this.vSupplyNeg = 0.0;        // 0V (Single-supply ground)
        this.vMid = 1.65;             // Virtual ground bias (V_DD / 2)

        // Internal Multiplexer Clock State (500 Hz timing cycle: 0 -> Red, 1 -> Dark1, 2 -> IR, 3 -> Dark2)
        this.clockPhase = 0;
        this.clockTime = 0;

        // Sample-and-Hold Buffers
        this.sampleRedRaw = 0;
        this.sampleIRRaw = 0;
        this.sampleDark = 0;
        this.demuxRed = 0;
        this.demuxIR = 0;

        // Filter States (Continuous 1st & 2nd order solvers)
        this.hpfRedState = { y: 0, x_prev: 0 };
        this.hpfIRState = { y: 0, x_prev: 0 };
        this.lpfRedState = { y: 0, y_prev: 0, y_prev2: 0 };
        this.lpfIRState = { y: 0, y_prev: 0, y_prev2: 0 };

        // DC Baseline Tracking (slow 0.05 Hz filter)
        this.dcRed = 1.65;
        this.dcIR = 1.65;

        // Discretization Sample-and-Hold state
        this.lastSampleHoldTime = 0;
        this.lastSampledAdcRed = 0;
        this.lastSampledAdcIR = 0;

        // Status Flags & Warnings
        this.isTiaSaturated = false;
        this.isPgaClipped = false;
        this.isAliasingRisk = false;
        this.quantizationStep = 3.3 / Math.pow(2, 12);
    }

    setParam(key, value) {
        if (key in this.params) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                this.params[key] = num;
                if (key === 'adcBits') {
                    this.quantizationStep = 3.3 / (Math.pow(2, this.params.adcBits) - 1);
                }
                if (key === 'samplingRate') {
                    this.isAliasingRisk = (this.params.samplingRate < 2.0 * this.params.lpfCutoff * 2.0);
                }
            }
        }
    }

    getParams() {
        return { ...this.params };
    }

    /**
     * Discrete 1st-order High-Pass Filter Step
     * H(s) = s / (s + omega_c)
     */
    stepHPF(x, state, fc, dt) {
        const rc = 1.0 / (2.0 * Math.PI * fc);
        const alpha = rc / (rc + dt);
        const y = alpha * (state.y + x - state.x_prev);
        state.x_prev = x;
        state.y = y;
        return y;
    }

    /**
     * Discrete 2nd-order Butterworth Low-Pass Filter Step
     */
    stepLPF(x, state, fc, dt) {
        const omega = 2.0 * Math.PI * fc;
        const K = Math.tan(omega * dt / 2.0);
        const K2 = K * K;
        const sqrt2 = Math.SQRT2;
        const denom = 1.0 + sqrt2 * K + K2;

        const a0 = K2 / denom;
        const a1 = 2.0 * a0;
        const a2 = a0;
        const b1 = 2.0 * (K2 - 1.0) / denom;
        const b2 = (1.0 - sqrt2 * K + K2) / denom;

        const y = a0 * x + a1 * (state.x_prev || 0) + a2 * (state.x_prev2 || 0)
                - b1 * (state.y_prev || 0) - b2 * (state.y_prev2 || 0);

        state.x_prev2 = state.x_prev || 0;
        state.x_prev = x;
        state.y_prev2 = state.y_prev || 0;
        state.y_prev = y;
        state.y = y;
        return y;
    }

    /**
     * ADC Quantizer: Quantizes voltage (0 to 3.3V) according to selected bit depth
     * @param {number} v Voltage in Volts
     * @param {number} bits ADC Resolution (8, 10, 12, 16)
     */
    quantizeADC(v, bits) {
        // Clamp to ADC range [0V, 3.3V]
        const clamped = Math.max(0.0, Math.min(this.vSupplyPos, v));
        const maxCounts = Math.pow(2, bits) - 1;
        const counts = Math.round((clamped / this.vSupplyPos) * maxCounts);
        return (counts / maxCounts) * this.vSupplyPos;
    }

    /**
     * Execute one circuit emulation step
     * @param {number} dt Time step (seconds)
     * @param {Object} optical Optical simulation output from OpticalPhysicsEngine
     */
    step(dt, optical) {
        this.clockTime += dt;

        // 1. STAGE 1: LED Drive & Multiplexing Clock (500 Hz switching cycle)
        // 4 Phases: 0 = Red ON, 1 = Dark 1, 2 = IR ON, 3 = Dark 2
        const muxFreq = 500.0;
        const muxPhase = (this.clockTime * muxFreq) % 1.0;
        let activeLED = 'DARK';

        if (muxPhase < 0.25) {
            activeLED = 'RED';
        } else if (muxPhase < 0.50) {
            activeLED = 'DARK1';
        } else if (muxPhase < 0.75) {
            activeLED = 'IR';
        } else {
            activeLED = 'DARK2';
        }

        // 2. STAGE 2: Photodiode Optical-to-Electrical Transduction
        // Responsivities: R_660 = 0.45 A/W, R_940 = 0.65 A/W
        const respRed = 0.45;
        const respIR = 0.65;
        const darkCurrent = 1e-9; // 1 nA dark current

        // Incident light on photodiode (optical power converted to current)
        let iPhotodiode = darkCurrent;

        // Mains room lighting interference (50Hz / 60Hz ambient hum)
        const ambientHum = (this.params.ambientLux / 100.0) * 0.08 * Math.sin(2.0 * Math.PI * this.params.mainsHumFreq * this.clockTime);
        const ambientTotal = (this.params.ambientLux / 100.0) * 0.15 + ambientHum;

        // Thermal / Johnson electrical noise
        const noiseFactor = this.params.noiseLevel * 0.04 * (Math.random() - 0.5);

        if (activeLED === 'RED') {
            const driveScale = this.params.ledCurrentRed / 20.0;
            iPhotodiode += (optical.optTransRed * driveScale * respRed * 1e-5) + (ambientTotal * 1e-5) + (noiseFactor * 1e-5);
        } else if (activeLED === 'IR') {
            const driveScale = this.params.ledCurrentIR / 20.0;
            iPhotodiode += (optical.optTransIR * driveScale * respIR * 1e-5) + (ambientTotal * 1e-5) + (noiseFactor * 1e-5);
        } else {
            // Dark phase: receives only ambient light + dark current + noise
            iPhotodiode += (ambientTotal * 1e-5) + (noiseFactor * 1e-5);
        }

        iPhotodiode = Math.max(0.0, iPhotodiode);

        // 3. STAGE 2 (cont): Transimpedance Amplifier (TIA)
        // V_TIA = I_PD * R_f with virtual ground offset at V_mid (1.65V)
        // Inverting configuration: V_out = V_bias + I_PD * R_f
        const rfOhms = this.params.rfTIA * 1000.0;
        let vTIA = (iPhotodiode * rfOhms);

        // Check for Op-Amp Rail Saturation (0V to 3.3V)
        this.isTiaSaturated = false;
        if (vTIA >= this.vSupplyPos - 0.05) {
            vTIA = this.vSupplyPos;
            this.isTiaSaturated = true;
        } else if (vTIA <= this.vSupplyNeg + 0.05) {
            vTIA = this.vSupplyNeg;
            this.isTiaSaturated = true;
        }

        // 4. STAGE 3: Synchronous Demultiplexer & Sample-and-Hold
        if (activeLED === 'RED') {
            this.sampleRedRaw = vTIA;
        } else if (activeLED === 'IR') {
            this.sampleIRRaw = vTIA;
        } else {
            this.sampleDark = vTIA;
        }

        // Ambient cancellation: Subtract dark phase voltage if enabled
        if (this.params.ambientCancelEnabled) {
            this.demuxRed = Math.max(0.0, this.sampleRedRaw - this.sampleDark);
            this.demuxIR = Math.max(0.0, this.sampleIRRaw - this.sampleDark);
        } else {
            this.demuxRed = this.sampleRedRaw;
            this.demuxIR = this.sampleIRRaw;
        }

        // 5. STAGE 4: Active Bandpass Filtering & DC Tracking
        // DC baseline tracking (slow low-pass filter, fc = 0.05 Hz)
        const alphaDC = dt / (dt + (1.0 / (2.0 * Math.PI * 0.05)));
        this.dcRed += alphaDC * (this.demuxRed - this.dcRed);
        this.dcIR += alphaDC * (this.demuxIR - this.dcIR);

        // High-Pass Filter: Strip high DC offset to isolate AC pulsatile wave
        const acRedHPF = this.stepHPF(this.demuxRed, this.hpfRedState, this.params.hpfCutoff, dt);
        const acIRHPF = this.stepHPF(this.demuxIR, this.hpfIRState, this.params.hpfCutoff, dt);

        // Low-Pass Filter: Sallen-Key 2nd-order anti-aliasing
        const acRedLPF = this.stepLPF(acRedHPF, this.lpfRedState, this.params.lpfCutoff, dt);
        const acIRLPF = this.stepLPF(acIRHPF, this.lpfIRState, this.params.lpfCutoff, dt);

        // 6. STAGE 5: Programmable Gain Amplifier (PGA)
        // Centers around 1.65V bias: V_PGA = 1.65V + Gain * V_AC
        let vPgaRed = this.vMid + (acRedLPF * this.params.pgaGain);
        let vPgaIR = this.vMid + (acIRLPF * this.params.pgaGain);

        // Check for PGA Rail Clipping
        this.isPgaClipped = false;
        if (vPgaRed >= this.vSupplyPos || vPgaRed <= this.vSupplyNeg ||
            vPgaIR >= this.vSupplyPos || vPgaIR <= this.vSupplyNeg) {
            this.isPgaClipped = true;
            vPgaRed = Math.max(this.vSupplyNeg, Math.min(this.vSupplyPos, vPgaRed));
            vPgaIR = Math.max(this.vSupplyNeg, Math.min(this.vSupplyPos, vPgaIR));
        }

        // 7. STAGE 6: ADC Discretization & Sampling Discretization
        // Discretize based on selected sampling rate (Sample-and-Hold)
        const sampleHoldInterval = 1.0 / this.params.samplingRate;
        if (this.clockTime - this.lastSampleHoldTime >= sampleHoldInterval) {
            this.lastSampleHoldTime = this.clockTime;
            // Apply ADC bit-depth quantization
            this.lastSampledAdcRed = this.quantizeADC(vPgaRed, this.params.adcBits);
            this.lastSampledAdcIR = this.quantizeADC(vPgaIR, this.params.adcBits);
        }

        return {
            time: this.clockTime,
            activeLED: activeLED,
            // Test Points
            tp1_rawPhotodiodeCurrent: iPhotodiode * 1e6, // microAmps
            tp2_tiaVoltage: vTIA,                        // Volts
            tp3_demuxRed: this.demuxRed,                 // Volts
            tp3_demuxIR: this.demuxIR,                   // Volts
            tp4_acRedFiltered: acRedLPF,                 // AC Volts
            tp4_acIRFiltered: acIRLPF,                   // AC Volts
            tp5_pgaRed: vPgaRed,                         // Volts
            tp5_pgaIR: vPgaIR,                           // Volts
            tp6_adcRed: this.lastSampledAdcRed,          // Quantized Volts
            tp6_adcIR: this.lastSampledAdcIR,            // Quantized Volts
            // Baselines for DSP
            dcRed: Math.max(0.1, this.dcRed),
            dcIR: Math.max(0.1, this.dcIR),
            // Diagnostic status
            isTiaSaturated: this.isTiaSaturated,
            isPgaClipped: this.isPgaClipped,
            isAliasingRisk: this.isAliasingRisk,
            adcBits: this.params.adcBits,
            quantizationStep: this.quantizationStep
        };
    }
}

if (typeof window !== 'undefined') {
    window.CircuitEmulator = CircuitEmulator;
}
