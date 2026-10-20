/**
 * physics-engine.js
 * Biomedical Optical Physics & Biomechanics Engine for Pulse Oximetry
 *
 * Implements:
 * 1. Beer-Lambert Optical Absorption Law
 * 2. Molar Extinction Spectra for Oxyhemoglobin (HbO2) & Deoxyhemoglobin (Hb) at 660nm, 940nm & 805nm
 * 3. Physiological Hemodynamic Photoplethysmogram (PPG) Waveform Synthesis:
 *    - Anacrotic systolic ejection upstroke
 *    - Dicrotic notch (aortic valve closure)
 *    - Catacrotic diastolic reflection wave
 *    - Respiratory baseline wander (respiratory sinus arrhythmia)
 *    - Perfusion Index (PI) dynamic scaling
 *    - Motion tremor & artifact generation
 *
 * Educational conceptual model — not for clinical diagnosis.
 */

class OpticalPhysicsEngine {
    constructor() {
        // Molar extinction coefficients [L / (mmol * cm)]
        // Wavelengths: 660 nm (Red) and 940 nm (Infrared), 805 nm (Isosbestic point)
        this.spectra = {
            660: {
                hb: 0.810,      // Deoxyhemoglobin has high absorption in Red
                hbo2: 0.080     // Oxyhemoglobin has low absorption in Red (~10x lower)
            },
            940: {
                hb: 0.180,      // Deoxyhemoglobin has moderate absorption in IR
                hbo2: 0.290     // Oxyhemoglobin has higher absorption in IR
            },
            805: {
                hb: 0.200,      // Isosbestic point: equal extinction
                hbo2: 0.200
            }
        };

        // Patient physiological state parameters
        this.patient = {
            trueSpO2: 98.0,            // % (65.0 - 100.0%)
            heartRate: 75,             // BPM (40 - 180 BPM)
            perfusionIndex: 2.5,       // % (0.1 - 10.0%) - pulsatile vs non-pulsatile blood
            respirationRate: 14,       // Breaths per min (modulates venous return & baseline)
            skinPigmentation: 1.0,     // Attenuation factor: 1.0 = light, 1.5 = medium, 2.2 = dark
            tissueThickness: 1.0,      // Normalized optical pathlength
            motionArtifact: 0.0,       // 0.0 (none) to 1.0 (severe motion artifact)
            signalNoise: 0.05          // Baseline physiological & optical scatter noise
        };

        // Continuous phase & timing trackers
        this.cardiacPhase = 0.0;
        this.respiratoryPhase = 0.0;
        this.time = 0.0;
        this.lastHeartBeatTime = 0.0;
        this.isNewBeat = false;

        // Random walk motion state
        this.motionOffset = 0.0;
        this.motionVelocity = 0.0;
    }

    /**
     * Update a physiological parameter safely
     */
    setPatientParam(key, value) {
        if (key in this.patient) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                this.patient[key] = num;
            }
        }
    }

    getPatientState() {
        return { ...this.patient };
    }

    /**
     * Theoretical Modulation Ratio R according to Beer-Lambert Law:
     * R = [ (AC_660 / DC_660) / (AC_940 / DC_940) ]
     */
    computeTheoreticalR(spO2Percent) {
        const s = Math.max(0.01, Math.min(1.0, spO2Percent / 100.0));
        const ext660 = (1.0 - s) * this.spectra[660].hb + s * this.spectra[660].hbo2;
        const ext940 = (1.0 - s) * this.spectra[940].hb + s * this.spectra[940].hbo2;
        return ext660 / Math.max(0.001, ext940);
    }

    /**
     * Standard empirical calibration equation: SpO2 = 110 - 25 * R
     */
    rToSpO2Empirical(r) {
        const spo2 = 110.0 - 25.0 * r;
        return Math.max(50.0, Math.min(100.0, spo2));
    }

    /**
     * Synthesizes a realistic single arterial volume pulse wave (0.0 to 1.0)
     * Models:
     * - Fast systolic ventricular ejection upstroke (anacrotic limb)
     * - Systolic peak
     * - Dicrotic notch caused by aortic valve closure
     * - Secondary diastolic wave caused by arterial elastic recoil (catacrotic limb)
     * @param {number} t Normalized cardiac phase [0, 1)
     */
    synthesizeSinglePulse(t) {
        t = t % 1.0;
        if (t < 0) t += 1.0;

        // 1. Primary systolic peak
        const t1 = 0.16;
        const s1 = 0.065;
        const systolic = Math.exp(-Math.pow(t - t1, 2) / (2 * s1 * s1));

        // 2. Dicrotic notch reflection dip
        const tNotch = 0.34;
        const sNotch = 0.035;
        const notchDip = 0.28 * Math.exp(-Math.pow(t - tNotch, 2) / (2 * sNotch * sNotch));

        // 3. Diastolic reflection wave (arterial compliance wave)
        const t2 = 0.44;
        const s2 = 0.085;
        const diastolic = 0.42 * Math.exp(-Math.pow(t - t2, 2) / (2 * s2 * s2));

        // 4. Exponential diastolic decay baseline
        const decay = 0.12 * Math.exp(-t * 2.5);

        let wave = systolic - notchDip + diastolic + decay;
        return Math.max(0.0, wave);
    }

    /**
     * Advance physical simulation by time step dt (seconds)
     * Returns optical transmitted power received by photodetector for Red (660nm) and IR (940nm)
     * @param {number} dt Time step in seconds (e.g. 0.002s for 500 Hz)
     * @param {number} ambientLux Stray ambient light in lux
     */
    step(dt, ambientLux = 40.0) {
        this.time += dt;

        // Cardiac frequency (Hz)
        const fCardiac = Math.max(0.5, Math.min(3.5, this.patient.heartRate / 60.0));
        const prevPhase = this.cardiacPhase;
        this.cardiacPhase = (this.cardiacPhase + fCardiac * dt) % 1.0;

        // Detect new systolic beat onset
        if (this.cardiacPhase < prevPhase) {
            this.isNewBeat = true;
            this.lastHeartBeatTime = this.time;
        } else {
            this.isNewBeat = false;
        }

        // Respiration frequency (Hz)
        const fResp = Math.max(0.1, Math.min(0.6, this.patient.respirationRate / 60.0));
        this.respiratoryPhase = (this.respiratoryPhase + fResp * dt) % 1.0;

        // Synthesize normalized arterial pulsatile volume Delta V (t)
        const rawPulse = this.synthesizeSinglePulse(this.cardiacPhase);

        // Modulate with respiration (Respiratory Sinus Arrhythmia & Traube-Hering-Mayer waves)
        const respMod = 1.0 + 0.12 * Math.sin(2.0 * Math.PI * this.respiratoryPhase);
        const arterialVolumeAC = rawPulse * respMod;

        // Motion artifact simulation: filtered random walk with damping
        if (this.patient.motionArtifact > 0.01) {
            const randomAccel = (Math.random() - 0.5) * 60.0 * this.patient.motionArtifact;
            this.motionVelocity += randomAccel * dt - 6.0 * this.motionVelocity * dt;
            this.motionOffset += this.motionVelocity * dt;
            this.motionOffset = Math.max(-0.8, Math.min(0.8, this.motionOffset));
        } else {
            this.motionOffset *= 0.95;
            this.motionVelocity = 0.0;
        }

        // Physiological noise (capillary bed fluctuations + optical quantum noise)
        const noiseAmp = (this.patient.signalNoise || 0.05) * 0.04;
        const noiseVal = (Math.random() - 0.5) * noiseAmp;

        // Compute optical absorption via Beer-Lambert Law:
        // Transmitted light: I(t) = I_0 * exp( -mu_eff * d(t) )
        // mu_eff = (1 - SpO2) * eps_Hb + SpO2 * eps_HbO2
        const s = Math.max(0.50, Math.min(1.0, this.patient.trueSpO2 / 100.0));

        // Extinction for Red (660 nm) and IR (940 nm)
        const extRed = (1.0 - s) * this.spectra[660].hb + s * this.spectra[660].hbo2;
        const extIR = (1.0 - s) * this.spectra[940].hb + s * this.spectra[940].hbo2;

        // Perfusion scaling: pulsatile fraction of total light absorption
        const piFraction = (this.patient.perfusionIndex / 100.0);

        // Constant DC baseline tissue absorption (bone, venous blood, connective tissue, pigmentation)
        const dcTissueBase = 1.2 * this.patient.skinPigmentation * this.patient.tissueThickness;

        // AC pulsatile absorbance: Higher extinction means MORE absorption -> LOWER transmitted light
        // delta_A(t) = eps * delta_d(t)
        const acAbsorbRed = extRed * piFraction * (arterialVolumeAC + this.motionOffset * 0.4 + noiseVal);
        const acAbsorbIR = extIR * piFraction * (arterialVolumeAC + this.motionOffset * 0.4 + noiseVal);

        // Optical transmission is inverse of absorption: T = exp(-A)
        // Linearized Taylor approximation around baseline: T(t) ~ T_dc * (1 - delta_A(t))
        const dcTransRed = 1.0 / (1.0 + dcTissueBase * 0.6);
        const dcTransIR = 1.0 / (1.0 + dcTissueBase * 0.5);

        // Transmitted optical power (relative arbitrary units 0.0 to 1.0)
        let optTransRed = dcTransRed * (1.0 - acAbsorbRed * 2.2);
        let optTransIR = dcTransIR * (1.0 - acAbsorbIR * 2.2);

        // Ambient stray light leakage (ambient photons bypassing finger and hitting photodetector)
        const ambientOptical = (ambientLux / 1000.0) * 0.08;

        return {
            time: this.time,
            cardiacPhase: this.cardiacPhase,
            isNewBeat: this.isNewBeat,
            rawPulse: rawPulse,
            arterialVolumeAC: arterialVolumeAC,
            optTransRed: Math.max(0.001, optTransRed),
            optTransIR: Math.max(0.001, optTransIR),
            ambientOptical: ambientOptical,
            theoreticalR: this.computeTheoreticalR(this.patient.trueSpO2),
            trueSpO2: this.patient.trueSpO2,
            heartRate: this.patient.heartRate,
            perfusionIndex: this.patient.perfusionIndex
        };
    }
}

if (typeof window !== 'undefined') {
    window.OpticalPhysicsEngine = OpticalPhysicsEngine;
}
