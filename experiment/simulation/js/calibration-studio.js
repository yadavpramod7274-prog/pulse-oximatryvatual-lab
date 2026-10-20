/**
 * calibration-studio.js
 * Educational Calibration Laboratory & Empirical Curve Fitting
 *
 * Implements the 9-Step Interactive Calibration Workflow:
 * 1. Initialize simulation.
 * 2. Select a simulated reference SpO2 value.
 * 3. Capture synthetic red/infrared signals.
 * 4. Calculate a simplified ratio-of-ratios (R).
 * 5. Enter or select a calibration coefficient (A, B, C).
 * 6. Compare the estimated output with the simulated reference.
 * 7. Display absolute error and percentage-point difference.
 * 8. Save the calibration run in a results table.
 * 9. Reset the calibration experiment.
 *
 * Plots Reference vs Estimated SpO2 using Chart.js.
 * Educational conceptual model — strictly simulated reference data.
 */

class CalibrationStudio {
    constructor(chartCanvasId, physicsEngine, circuitEmulator, dspEngine) {
        this.canvasId = chartCanvasId;
        this.physics = physicsEngine;
        this.circuit = circuitEmulator;
        this.dsp = dspEngine;

        // Current Step State (1 to 9)
        this.currentStep = 1;

        // Active Trial Working Memory
        this.activeTrial = {
            refSpO2: 98.0,
            acRed: 0.045,
            dcRed: 1.25,
            acIR: 0.075,
            dcIR: 1.30,
            normRed: 0.036,
            normIR: 0.058,
            ratioR: 0.62,
            coeffA: 110.0,
            coeffB: 25.0,
            coeffC: 0.0,
            modelType: 'linear',
            estSpO2: 94.5,
            absError: 3.5,
            diffPct: -3.5,
            timestamp: new Date().toLocaleTimeString()
        };

        // Saved Calibration Dataset
        this.calibrationRuns = [
            { id: 1, refSpO2: 98.0, r: 0.480, acRed: 0.038, dcRed: 1.25, acIR: 0.082, dcIR: 1.30, estSpO2: 98.0, absError: 0.0, diff: 0.0, coeff: 'A=110, B=25', time: '10:00:15' },
            { id: 2, refSpO2: 90.0, r: 0.800, acRed: 0.061, dcRed: 1.25, acIR: 0.078, dcIR: 1.28, estSpO2: 90.0, absError: 0.0, diff: 0.0, coeff: 'A=110, B=25', time: '10:02:40' },
            { id: 3, refSpO2: 82.0, r: 1.120, acRed: 0.082, dcRed: 1.24, acIR: 0.074, dcIR: 1.26, estSpO2: 82.0, absError: 0.0, diff: 0.0, coeff: 'A=110, B=25', time: '10:04:12' }
        ];

        // Chart.js instance
        this.chart = null;

        // Callbacks
        this.onStepChanged = null;
        this.onRunSaved = null;

        this.initChart();
    }

    /**
     * Initialize Chart.js Calibration Plot
     */
    initChart() {
        const canvas = document.getElementById(this.canvasId);
        if (!canvas || typeof Chart === 'undefined') return;

        // Generate Ideal 1:1 reference line data (y = x)
        const idealData = [
            { x: 70, y: 70 },
            { x: 80, y: 80 },
            { x: 90, y: 90 },
            { x: 100, y: 100 }
        ];

        // Generate scatter points from saved runs
        const scatterData = this.calibrationRuns.map(run => ({
            x: run.refSpO2,
            y: run.estSpO2,
            r: run.r
        }));

        this.chart = new Chart(canvas, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Ideal 1:1 Reference Line',
                        data: idealData,
                        type: 'line',
                        borderColor: '#64748b',
                        borderDash: [6, 6],
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: 'Experimental Calibration Points (Ref vs Est)',
                        data: scatterData,
                        backgroundColor: '#00f2fe',
                        borderColor: '#06b6d4',
                        borderWidth: 2,
                        pointRadius: 7,
                        pointHoverRadius: 9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400 },
                scales: {
                    x: {
                        title: { display: true, text: 'Simulated Reference SpO₂ (%)', color: '#94a3b8' },
                        min: 65,
                        max: 102,
                        grid: { color: 'rgba(255, 255, 255, 0.07)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        title: { display: true, text: 'Estimated SpO₂ Output (%)', color: '#94a3b8' },
                        min: 65,
                        max: 102,
                        grid: { color: 'rgba(255, 255, 255, 0.07)' },
                        ticks: { color: '#94a3b8' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0', font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const pt = ctx.raw;
                                return `Ref: ${pt.x.toFixed(1)}% | Est: ${pt.y.toFixed(1)}% | R: ${pt.r ? pt.r.toFixed(3) : 'N/A'}`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateChart() {
        if (!this.chart) {
            this.initChart();
            return;
        }

        const scatterData = this.calibrationRuns.map(run => ({
            x: run.refSpO2,
            y: run.estSpO2,
            r: run.r
        }));

        this.chart.data.datasets[1].data = scatterData;
        this.chart.update();
    }

    // =========================================================================
    // 9-STEP WORKFLOW STATE MACHINE
    // =========================================================================

    /**
     * Step 1: Initialize Simulation
     */
    step1_initialize() {
        this.currentStep = 1;
        this.notifyStep();
        return {
            status: 'INITIALIZED',
            message: 'Baseline initialized. Sensor probe connected, photodiode biased at 1.65V, optical emitters ready.'
        };
    }

    /**
     * Step 2: Select Reference SpO2 Value
     */
    step2_selectReference(refSpO2) {
        const val = Math.max(65.0, Math.min(100.0, parseFloat(refSpO2) || 98.0));
        this.activeTrial.refSpO2 = val;
        
        // Update physics patient state to simulate this reference
        if (this.physics) {
            this.physics.setPatientParam('trueSpO2', val);
        }

        this.currentStep = 2;
        this.notifyStep();
        return {
            status: 'REFERENCE_SET',
            refSpO2: val,
            message: `Simulated reference set to ${val.toFixed(1)}% SpO₂.`
        };
    }

    /**
     * Step 3: Capture Synthetic Red & IR Signals
     */
    step3_captureSignals() {
        // Collect latest signals from DSP/Physics
        if (this.dsp) {
            this.activeTrial.acRed = Math.max(0.005, this.dsp.acRed || 0.045);
            this.activeTrial.dcRed = Math.max(0.1, this.dsp.dcRed || 1.25);
            this.activeTrial.acIR = Math.max(0.005, this.dsp.acIR || 0.075);
            this.activeTrial.dcIR = Math.max(0.1, this.dsp.dcIR || 1.30);
        }

        this.activeTrial.normRed = this.activeTrial.acRed / this.activeTrial.dcRed;
        this.activeTrial.normIR = this.activeTrial.acIR / this.activeTrial.dcIR;

        this.currentStep = 3;
        this.notifyStep();
        return {
            status: 'SIGNALS_CAPTURED',
            acRed: this.activeTrial.acRed,
            dcRed: this.activeTrial.dcRed,
            acIR: this.activeTrial.acIR,
            dcIR: this.activeTrial.dcIR,
            normRed: this.activeTrial.normRed,
            normIR: this.activeTrial.normIR
        };
    }

    /**
     * Step 4: Calculate Simplified Ratio-of-Ratios (R)
     */
    step4_calculateRatio() {
        const normRed = this.activeTrial.normRed;
        const normIR = Math.max(0.001, this.activeTrial.normIR);
        this.activeTrial.ratioR = normRed / normIR;

        this.currentStep = 4;
        this.notifyStep();
        return {
            status: 'RATIO_CALCULATED',
            ratioR: this.activeTrial.ratioR,
            formula: `R = (AC_660 / DC_660) / (AC_940 / DC_940) = (${normRed.toFixed(4)}) / (${normIR.toFixed(4)}) = ${this.activeTrial.ratioR.toFixed(4)}`
        };
    }

    /**
     * Step 5: Enter or Select Calibration Coefficient
     */
    step5_setCalibrationCoefficients(type, a, b, c = 0) {
        this.activeTrial.modelType = type || 'linear';
        this.activeTrial.coeffA = parseFloat(a) || 110.0;
        this.activeTrial.coeffB = parseFloat(b) || 25.0;
        this.activeTrial.coeffC = parseFloat(c) || 0.0;

        // Deploy to live DSP processor
        if (this.dsp) {
            this.dsp.setCalibration(this.activeTrial.modelType, this.activeTrial.coeffA, this.activeTrial.coeffB, this.activeTrial.coeffC);
        }

        this.currentStep = 5;
        this.notifyStep();
        return {
            status: 'COEFFICIENTS_SET',
            coeffA: this.activeTrial.coeffA,
            coeffB: this.activeTrial.coeffB,
            coeffC: this.activeTrial.coeffC,
            modelType: this.activeTrial.modelType
        };
    }

    /**
     * Step 6: Compare Estimated Output with Simulated Reference
     */
    step6_compareOutput() {
        const r = this.activeTrial.ratioR;
        let est = 98.0;

        if (this.activeTrial.modelType === 'poly') {
            est = this.activeTrial.coeffC + (this.activeTrial.coeffB * r) + (this.activeTrial.coeffA * r * r);
        } else {
            // Linear model: SpO2 = A - B * R
            est = this.activeTrial.coeffA - (this.activeTrial.coeffB * r);
        }

        this.activeTrial.estSpO2 = Math.max(50.0, Math.min(100.0, est));

        this.currentStep = 6;
        this.notifyStep();
        return {
            status: 'OUTPUT_COMPARED',
            refSpO2: this.activeTrial.refSpO2,
            estSpO2: this.activeTrial.estSpO2
        };
    }

    /**
     * Step 7: Display Absolute Error and Percentage-Point Difference
     */
    step7_computeErrors() {
        const diff = this.activeTrial.estSpO2 - this.activeTrial.refSpO2;
        const absErr = Math.abs(diff);

        this.activeTrial.diffPct = diff;
        this.activeTrial.absError = absErr;

        let grade = 'CLINICAL_GRADE'; // <= 2.0% error
        if (absErr > 3.5) {
            grade = 'HIGH_ERROR';
        } else if (absErr > 2.0) {
            grade = 'ACCEPTABLE';
        }

        this.currentStep = 7;
        this.notifyStep();
        return {
            status: 'ERRORS_COMPUTED',
            absError: absErr,
            diffPct: diff,
            grade: grade
        };
    }

    /**
     * Step 8: Save Calibration Run in Results Table
     */
    step8_saveCalibrationRun() {
        const newRun = {
            id: this.calibrationRuns.length + 1,
            refSpO2: this.activeTrial.refSpO2,
            r: this.activeTrial.ratioR,
            acRed: this.activeTrial.acRed,
            dcRed: this.activeTrial.dcRed,
            acIR: this.activeTrial.acIR,
            dcIR: this.activeTrial.dcIR,
            estSpO2: this.activeTrial.estSpO2,
            absError: this.activeTrial.absError,
            diff: this.activeTrial.diffPct,
            coeff: `A=${this.activeTrial.coeffA}, B=${this.activeTrial.coeffB}`,
            time: new Date().toLocaleTimeString()
        };

        this.calibrationRuns.push(newRun);
        this.updateChart();

        this.currentStep = 8;
        this.notifyStep();

        if (this.onRunSaved && typeof this.onRunSaved === 'function') {
            this.onRunSaved(newRun);
        }

        return {
            status: 'RUN_SAVED',
            run: newRun,
            totalRuns: this.calibrationRuns.length
        };
    }

    /**
     * Step 9: Reset Calibration Experiment
     */
    step9_resetExperiment(clearSaved = false) {
        this.currentStep = 1;
        this.activeTrial = {
            refSpO2: 98.0,
            acRed: 0.045,
            dcRed: 1.25,
            acIR: 0.075,
            dcIR: 1.30,
            normRed: 0.036,
            normIR: 0.058,
            ratioR: 0.62,
            coeffA: 110.0,
            coeffB: 25.0,
            coeffC: 0.0,
            modelType: 'linear',
            estSpO2: 94.5,
            absError: 3.5,
            diffPct: -3.5,
            timestamp: new Date().toLocaleTimeString()
        };

        if (clearSaved) {
            this.calibrationRuns = [];
            this.updateChart();
        }

        this.notifyStep();
        return {
            status: 'RESET_COMPLETE',
            message: 'Calibration state reset.'
        };
    }

    notifyStep() {
        if (this.onStepChanged && typeof this.onStepChanged === 'function') {
            this.onStepChanged(this.currentStep, this.activeTrial);
        }
    }

    /**
     * Compute Goodness-of-Fit Statistics (R^2, MAE, RMSE)
     */
    getStatistics() {
        if (this.calibrationRuns.length < 2) {
            return { r2: 1.0, mae: 0.0, rmse: 0.0, count: this.calibrationRuns.length };
        }

        let sumAbsErr = 0;
        let sumSqErr = 0;
        let sumRef = 0;

        this.calibrationRuns.forEach(r => {
            sumAbsErr += Math.abs(r.estSpO2 - r.refSpO2);
            sumSqErr += Math.pow(r.estSpO2 - r.refSpO2, 2);
            sumRef += r.refSpO2;
        });

        const n = this.calibrationRuns.length;
        const mae = sumAbsErr / n;
        const rmse = Math.sqrt(sumSqErr / n);
        const meanRef = sumRef / n;

        let ssTot = 0;
        let ssRes = 0;
        this.calibrationRuns.forEach(r => {
            ssTot += Math.pow(r.refSpO2 - meanRef, 2);
            ssRes += Math.pow(r.estSpO2 - r.refSpO2, 2);
        });

        const r2 = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 1.0;

        return {
            r2: r2,
            mae: mae,
            rmse: rmse,
            count: n
        };
    }
}

if (typeof window !== 'undefined') {
    window.CalibrationStudio = CalibrationStudio;
}
