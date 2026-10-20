/**
 * app.js
 * Main Virtual Laboratory Controller for Pulse Oximetry
 *
 * Integrates:
 * - Physics Engine (Beer-Lambert Law & Hemodynamic PPG synthesis)
 * - Circuit Emulator (Block-level analog & digital electronics)
 * - DSP Processor (Peak detection, Ratio R, empirical SpO2 estimation)
 * - 3D Virtual Reality Lab (Three.js WebGL model & raycasting)
 * - Calibration Studio (9-step calibration workflow & curve fitting)
 * - Real-Time Chart.js Waveforms Manager
 * - Web Audio Pulse Synthesizer
 * - Navigation Tabs: Home, Circuit Lab, Calibration, Simulation, Results, About
 * - Control Buttons: Start, Pause, Resume, Reset, Export Results
 * - Beginner Instructions & Tooltips
 * - Experimental Results Logging & CSV/JSON/Print Export
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Instantiate Core Engineering Subsystems
    const physics = new OpticalPhysicsEngine();
    const circuit = new CircuitEmulator();
    const dsp = new DspProcessor();
    const audio = new PulseAudioSynthesizer();
    const charts = new ChartsManager();
    const calib = new CalibrationStudio('calibration-chart-canvas', physics, circuit, dsp);

    // 3D Virtual Reality Lab
    let lab3D = null;
    if (typeof PulseOximetry3DLab !== 'undefined') {
        lab3D = new PulseOximetry3DLab('webgl-3d-viewport', physics, circuit, dsp);
    }

    // 2. State & Telemetry Variables
    let isRunning = true;
    let isPaused = false;
    let simulationDurationSec = 0;
    let lastTime = performance.now();
    const simDt = 0.002; // 500 Hz simulation micro-step
    let simAccumulator = 0;

    // Results logging database
    let experimentResults = [
        { id: 1, mode: 'Calibration', time: '10:00:15', refSpO2: 98.0, estSpO2: 98.0, absError: 0.0, bpm: 75, r: 0.480, pi: 2.50, sqi: 98 },
        { id: 2, mode: 'Calibration', time: '10:02:40', refSpO2: 90.0, estSpO2: 90.0, absError: 0.0, bpm: 75, r: 0.800, pi: 2.45, sqi: 96 },
        { id: 3, mode: 'Calibration', time: '10:04:12', refSpO2: 82.0, estSpO2: 82.0, absError: 0.0, bpm: 75, r: 1.120, pi: 2.30, sqi: 95 },
        { id: 4, mode: 'Simulation',  time: '10:06:30', refSpO2: 98.0, estSpO2: 98.2, absError: 0.2, bpm: 75, r: 0.472, pi: 2.50, sqi: 96 }
    ];

    // Audio beat callback on systolic peak detection
    dsp.onBeatDetected = (metrics) => {
        if (!isPaused && isRunning) {
            audio.playPulseTone(metrics.spO2);

            // Animate Heart Icon & Plethysmograph bar
            const heartIcon = document.getElementById('heart-pulse-icon');
            if (heartIcon) {
                heartIcon.classList.add('pulse-active');
                setTimeout(() => heartIcon.classList.remove('pulse-active'), 180);
            }
        }
    };

    // 3. High-Performance Simulation & Telemetry Loop
    function mainLoop(now) {
        requestAnimationFrame(mainLoop);

        const deltaSec = Math.min(0.1, (now - lastTime) / 1000.0);
        lastTime = now;

        if (!isRunning || isPaused) return;

        simAccumulator += deltaSec;
        simulationDurationSec += deltaSec;

        let latestSample = null;
        let latestDSP = null;

        // Run discrete micro-steps for continuous circuit filter solvers
        while (simAccumulator >= simDt) {
            const optical = physics.step(simDt, circuit.params.ambientLux);
            latestSample = circuit.step(simDt, optical);
            latestDSP = dsp.processSample(latestSample);
            simAccumulator -= simDt;
        }

        // Update real-time scrolling charts (60 fps)
        if (latestSample && latestDSP) {
            charts.updateWaveforms(latestSample, latestDSP);
            updateTelemetryDisplay(latestDSP, latestSample, physics.getPatientState());
        }

        // Update duration counter
        const durEl = document.getElementById('sim-duration-display');
        if (durEl) {
            const mins = Math.floor(simulationDurationSec / 60).toString().padStart(2, '0');
            const secs = Math.floor(simulationDurationSec % 60).toString().padStart(2, '0');
            durEl.textContent = `${mins}:${secs}`;
        }
    }
    requestAnimationFrame(mainLoop);

    // 4. Update Header Vitals Banner & HUD Telemetry
    function updateTelemetryDisplay(dspData, sample, patient) {
        // Target Reference vs Estimated SpO2
        const monRefSpO2 = document.getElementById('mon-ref-spo2-val');
        const monEstSpO2 = document.getElementById('mon-est-spo2-val');
        const monBpm = document.getElementById('mon-bpm-val');
        const monPI = document.getElementById('mon-pi-val');
        const monR = document.getElementById('mon-r-val');
        const monSQI = document.getElementById('mon-sqi-val');
        const plethBar = document.getElementById('mon-pleth-bar');

        if (monRefSpO2) monRefSpO2.textContent = patient.trueSpO2.toFixed(1);
        if (monEstSpO2) monEstSpO2.textContent = dspData.spO2.toFixed(1);
        if (monBpm) monBpm.textContent = dspData.bpm;
        if (monPI) monPI.textContent = dspData.pi.toFixed(2) + '%';
        if (monR) monR.textContent = dspData.ratioR.toFixed(3);
        if (monSQI) monSQI.textContent = dspData.sqi + '%';

        // Plethysmograph vertical bar animation
        if (plethBar) {
            const h = Math.min(100, Math.max(5, (dspData.pi / 4.0) * 85));
            plethBar.style.height = `${h}%`;
        }

        // Op-Amp Saturation / Rail Clipping Warning Badge
        const satBadge = document.getElementById('badge-rail-saturation');
        if (satBadge) {
            satBadge.style.display = (sample.isTiaSaturated || sample.isPgaClipped) ? 'inline-block' : 'none';
        }

        // Hypoxia monitor alarm color coding
        const monCard = document.getElementById('hospital-monitor-card');
        if (monCard) {
            monCard.classList.remove('alarm-hypoxia', 'alarm-warning');
            if (dspData.spO2 < 88.0) {
                monCard.classList.add('alarm-hypoxia');
            } else if (dspData.spO2 < 93.0) {
                monCard.classList.add('alarm-warning');
            }
        }
    }

    // =========================================================================
    // 5. NAVIGATION TABS (Home, Circuit Lab, Calibration, Simulation, Results, About)
    // =========================================================================
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    function switchTab(targetTabId) {
        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === targetTabId);
        });
        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === targetTabId);
        });

        // Trigger resize events for 3D lab and charts when tab becomes visible
        if (lab3D) lab3D.onWindowResize();
        if (targetTabId === 'tab-calibration' && calib) calib.updateChart();
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Quick Action Cards on Home tab
    document.querySelectorAll('[data-jump-tab]').forEach(el => {
        el.addEventListener('click', () => {
            const target = el.dataset.jumpTab;
            switchTab(target);
        });
    });

    // =========================================================================
    // 6. GLOBAL EXPERIMENT CONTROL BUTTONS (Start, Pause, Resume, Reset, Export)
    // =========================================================================
    const btnStart = document.getElementById('btn-global-start');
    const btnPause = document.getElementById('btn-global-pause');
    const btnResume = document.getElementById('btn-global-resume');
    const btnReset = document.getElementById('btn-global-reset');
    const btnExport = document.getElementById('btn-global-export');

    if (btnStart) {
        btnStart.addEventListener('click', () => {
            isRunning = true;
            isPaused = false;
            updateGlobalButtonStates();
        });
    }

    if (btnPause) {
        btnPause.addEventListener('click', () => {
            if (isRunning && !isPaused) {
                isPaused = true;
                updateGlobalButtonStates();
            }
        });
    }

    if (btnResume) {
        btnResume.addEventListener('click', () => {
            if (isRunning && isPaused) {
                isPaused = false;
                updateGlobalButtonStates();
            }
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            // Reset patient to healthy baseline
            physics.setPatientParam('trueSpO2', 98.0);
            physics.setPatientParam('heartRate', 75);
            physics.setPatientParam('perfusionIndex', 2.5);
            physics.setPatientParam('motionArtifact', 0.0);
            physics.setPatientParam('signalNoise', 0.05);

            // Reset circuit
            circuit.setParam('ledCurrentRed', 20.0);
            circuit.setParam('ledCurrentIR', 20.0);
            circuit.setParam('pgaGain', 35.0);
            circuit.setParam('noiseLevel', 0.05);
            circuit.setParam('ambientLux', 40.0);
            circuit.setParam('ambientCancelEnabled', true);
            circuit.setParam('adcBits', 12);
            circuit.setParam('samplingRate', 500);

            // Reset DSP
            dsp.setCalibration('linear', 110.0, 25.0);

            // Reset UI sliders
            syncUiSlidersWithState();

            simulationDurationSec = 0;
            isPaused = false;
            isRunning = true;
            updateGlobalButtonStates();
        });
    }

    if (btnExport) {
        btnExport.addEventListener('click', () => {
            openExportModal();
        });
    }

    function updateGlobalButtonStates() {
        if (btnStart) btnStart.disabled = isRunning && !isPaused;
        if (btnPause) btnPause.disabled = !isRunning || isPaused;
        if (btnResume) btnResume.disabled = !isRunning || !isPaused;
    }

    // Audio Volume & Mute Toggle
    const btnAudioMute = document.getElementById('btn-audio-mute');
    const sliderAudioVol = document.getElementById('slider-audio-vol');

    if (btnAudioMute) {
        btnAudioMute.addEventListener('click', () => {
            const nextMuted = !audio.isMuted;
            audio.setMuted(nextMuted);
            btnAudioMute.textContent = nextMuted ? '🔇 Audio Muted' : '🔊 Audio Active';
            btnAudioMute.classList.toggle('btn-secondary', nextMuted);
            btnAudioMute.classList.toggle('btn-primary', !nextMuted);
        });
    }

    if (sliderAudioVol) {
        sliderAudioVol.addEventListener('input', (e) => {
            audio.setVolume(e.target.value);
        });
    }

    // =========================================================================
    // 7. SIMULATION TAB: PARAMETERS & CLINICAL PRESETS
    // =========================================================================
    function bindSlider(sliderId, valueDisplayId, unit, setter) {
        const slider = document.getElementById(sliderId);
        const display = document.getElementById(valueDisplayId);
        if (slider && display) {
            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                display.textContent = val.toFixed(1) + (unit || '');
                setter(val);
            });
        }
    }

    bindSlider('slider-sim-spo2', 'val-sim-spo2', '%', v => physics.setPatientParam('trueSpO2', v));
    bindSlider('slider-sim-bpm', 'val-sim-bpm', ' BPM', v => physics.setPatientParam('heartRate', v));
    bindSlider('slider-sim-noise', 'val-sim-noise', '', v => physics.setPatientParam('signalNoise', v));
    bindSlider('slider-sim-pi', 'val-sim-pi', '%', v => physics.setPatientParam('perfusionIndex', v));
    bindSlider('slider-sim-resp', 'val-sim-resp', ' Br/min', v => physics.setPatientParam('respirationRate', v));
    bindSlider('slider-sim-motion', 'val-sim-motion', '', v => physics.setPatientParam('motionArtifact', v));

    // Clinical Scenario Presets
    const clinicalPresets = {
        'preset-healthy': { spo2: 98.0, bpm: 75, pi: 2.5, noise: 0.05, motion: 0.0 },
        'preset-mild-hypoxia': { spo2: 88.0, bpm: 95, pi: 2.2, noise: 0.08, motion: 0.0 },
        'preset-severe-hypoxia': { spo2: 74.0, bpm: 115, pi: 1.8, noise: 0.12, motion: 0.0 },
        'preset-bradycardia': { spo2: 99.0, bpm: 48, pi: 3.5, noise: 0.04, motion: 0.0 },
        'preset-low-perfusion': { spo2: 95.0, bpm: 82, pi: 0.4, noise: 0.15, motion: 0.0 },
        'preset-ambient-hum': { spo2: 98.0, bpm: 75, pi: 2.5, noise: 0.35, motion: 0.2 }
    };

    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.preset;
            const p = clinicalPresets[key];
            if (p) {
                physics.setPatientParam('trueSpO2', p.spo2);
                physics.setPatientParam('heartRate', p.bpm);
                physics.setPatientParam('perfusionIndex', p.pi);
                physics.setPatientParam('signalNoise', p.noise);
                physics.setPatientParam('motionArtifact', p.motion);
                syncUiSlidersWithState();
            }
        });
    });

    function syncUiSlidersWithState() {
        const s = physics.getPatientState();
        const setVal = (id, textId, val, unit) => {
            const el = document.getElementById(id);
            const txt = document.getElementById(textId);
            if (el) el.value = val;
            if (txt) txt.textContent = parseFloat(val).toFixed(1) + (unit || '');
        };

        setVal('slider-sim-spo2', 'val-sim-spo2', s.trueSpO2, '%');
        setVal('slider-sim-bpm', 'val-sim-bpm', s.heartRate, ' BPM');
        setVal('slider-sim-pi', 'val-sim-pi', s.perfusionIndex, '%');
        setVal('slider-sim-noise', 'val-sim-noise', s.signalNoise, '');
        setVal('slider-sim-resp', 'val-sim-resp', s.respirationRate, ' Br/min');
        setVal('slider-sim-motion', 'val-sim-motion', s.motionArtifact, '');
    }

    // =========================================================================
    // 8. CIRCUIT LAB TAB: CONTROLS & TEST POINTS
    // =========================================================================
    bindSlider('slider-led-red', 'val-led-red', ' mA', v => circuit.setParam('ledCurrentRed', v));
    bindSlider('slider-led-ir', 'val-led-ir', ' mA', v => circuit.setParam('ledCurrentIR', v));
    bindSlider('slider-amp-gain', 'val-amp-gain', 'x', v => circuit.setParam('pgaGain', v));
    bindSlider('slider-amp-rf', 'val-amp-rf', ' kΩ', v => circuit.setParam('rfTIA', v));
    bindSlider('slider-circuit-noise', 'val-circuit-noise', '', v => circuit.setParam('noiseLevel', v));
    bindSlider('slider-ambient-lux', 'val-ambient-lux', ' lux', v => circuit.setParam('ambientLux', v));

    // Ambient Cancellation Toggle
    const chkAmbientCancel = document.getElementById('chk-ambient-cancel');
    if (chkAmbientCancel) {
        chkAmbientCancel.addEventListener('change', (e) => {
            circuit.setParam('ambientCancelEnabled', e.target.checked);
        });
    }

    // ADC Bit Depth Selector
    const selAdcBits = document.getElementById('select-adc-bits');
    if (selAdcBits) {
        selAdcBits.addEventListener('change', (e) => {
            const bits = parseInt(e.target.value);
            circuit.setParam('adcBits', bits);
            const stepEl = document.getElementById('val-quantization-step');
            if (stepEl) {
                const stepMv = (3300.0 / (Math.pow(2, bits) - 1)).toFixed(2);
                stepEl.textContent = `${stepMv} mV`;
            }
        });
    }

    // Sampling Rate Selector
    const selSamplingRate = document.getElementById('select-sampling-rate');
    if (selSamplingRate) {
        selSamplingRate.addEventListener('change', (e) => {
            circuit.setParam('samplingRate', parseInt(e.target.value));
        });
    }

    // Circuit Oscilloscope Test Point Buttons (TP1 to TP5)
    document.querySelectorAll('[data-tp]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-tp]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tpKey = btn.dataset.tp;
            const tpName = btn.dataset.tpName || 'Test Point';
            const yMin = parseFloat(btn.dataset.min || '0');
            const yMax = parseFloat(btn.dataset.max || '3.3');
            charts.setCircuitTestPoint(tpKey, tpName, yMin, yMax);
        });
    });

    // =========================================================================
    // 9. CALIBRATION LAB TAB: 9-STEP WORKFLOW UI
    // =========================================================================
    const btnCalibStepNext = document.getElementById('btn-calib-step-next');
    const btnCalibStepReset = document.getElementById('btn-calib-reset');
    const selCalibRef = document.getElementById('select-calib-ref');
    const inputCalibRefCustom = document.getElementById('input-calib-ref-custom');
    const selCalibCoeffPreset = document.getElementById('select-calib-coeff-preset');
    const inputCoeffA = document.getElementById('input-coeff-a');
    const inputCoeffB = document.getElementById('input-coeff-b');

    // Update UI when calibration step changes
    calib.onStepChanged = (step, trial) => {
        // Highlight active step pill in workflow bar
        document.querySelectorAll('.workflow-step-pill').forEach((pill, idx) => {
            const stepNum = idx + 1;
            pill.classList.toggle('active', stepNum === step);
            pill.classList.toggle('completed', stepNum < step);
        });

        // Update step panels visibility
        document.querySelectorAll('.calib-step-card').forEach(card => {
            const cardStep = parseInt(card.dataset.step);
            card.classList.toggle('active', cardStep === step);
        });

        // Update numerical values in summary card
        const elRef = document.getElementById('calib-disp-ref');
        const elAcDcRed = document.getElementById('calib-disp-acdc-red');
        const elAcDcIR = document.getElementById('calib-disp-acdc-ir');
        const elR = document.getElementById('calib-disp-r');
        const elCoeff = document.getElementById('calib-disp-coeff');
        const elEst = document.getElementById('calib-disp-est');
        const elErr = document.getElementById('calib-disp-err');

        if (elRef) elRef.textContent = trial.refSpO2.toFixed(1) + '%';
        if (elAcDcRed) elAcDcRed.textContent = trial.normRed ? trial.normRed.toFixed(4) : '--';
        if (elAcDcIR) elAcDcIR.textContent = trial.normIR ? trial.normIR.toFixed(4) : '--';
        if (elR) elR.textContent = trial.ratioR ? trial.ratioR.toFixed(4) : '--';
        if (elCoeff) elCoeff.textContent = `A=${trial.coeffA}, B=${trial.coeffB}`;
        if (elEst) elEst.textContent = trial.estSpO2 ? trial.estSpO2.toFixed(1) + '%' : '--';
        if (elErr) elErr.textContent = trial.absError !== undefined ? trial.absError.toFixed(2) + '%' : '--';
    };

    // Step Advancement Handler
    if (btnCalibStepNext) {
        btnCalibStepNext.addEventListener('click', () => {
            const cur = calib.currentStep;
            switch (cur) {
                case 1:
                    calib.step1_initialize();
                    calib.currentStep = 2;
                    calib.notifyStep();
                    break;
                case 2:
                    const refVal = inputCalibRefCustom && inputCalibRefCustom.value ? parseFloat(inputCalibRefCustom.value) : (selCalibRef ? parseFloat(selCalibRef.value) : 98.0);
                    calib.step2_selectReference(refVal);
                    calib.currentStep = 3;
                    calib.notifyStep();
                    break;
                case 3:
                    calib.step3_captureSignals();
                    calib.currentStep = 4;
                    calib.notifyStep();
                    break;
                case 4:
                    calib.step4_calculateRatio();
                    calib.currentStep = 5;
                    calib.notifyStep();
                    break;
                case 5:
                    const aVal = inputCoeffA ? parseFloat(inputCoeffA.value) : 110.0;
                    const bVal = inputCoeffB ? parseFloat(inputCoeffB.value) : 25.0;
                    calib.step5_setCalibrationCoefficients('linear', aVal, bVal);
                    calib.currentStep = 6;
                    calib.notifyStep();
                    break;
                case 6:
                    calib.step6_compareOutput();
                    calib.currentStep = 7;
                    calib.notifyStep();
                    break;
                case 7:
                    calib.step7_computeErrors();
                    calib.currentStep = 8;
                    calib.notifyStep();
                    break;
                case 8:
                    calib.step8_saveCalibrationRun();
                    calib.currentStep = 9;
                    calib.notifyStep();
                    break;
                case 9:
                    calib.step9_resetExperiment(false);
                    break;
            }
        });
    }

    if (btnCalibStepReset) {
        btnCalibStepReset.addEventListener('click', () => {
            calib.step9_resetExperiment(false);
        });
    }

    // Direct Jump to Step buttons
    document.querySelectorAll('[data-goto-step]').forEach(btn => {
        btn.addEventListener('click', () => {
            const stepNum = parseInt(btn.dataset.gotoStep);
            calib.currentStep = stepNum;
            calib.notifyStep();
        });
    });

    // Reference SpO2 Preset Selector
    if (selCalibRef) {
        selCalibRef.addEventListener('change', (e) => {
            if (inputCalibRefCustom) inputCalibRefCustom.value = e.target.value;
            calib.step2_selectReference(e.target.value);
        });
    }

    // Calibration Coefficient Presets
    if (selCalibCoeffPreset) {
        selCalibCoeffPreset.addEventListener('change', (e) => {
            const preset = e.target.value;
            if (preset === 'standard') {
                if (inputCoeffA) inputCoeffA.value = 110.0;
                if (inputCoeffB) inputCoeffB.value = 25.0;
            } else if (preset === 'nellcor') {
                if (inputCoeffA) inputCoeffA.value = 112.5;
                if (inputCoeffB) inputCoeffB.value = 28.0;
            } else if (preset === 'masimo') {
                if (inputCoeffA) inputCoeffA.value = 108.0;
                if (inputCoeffB) inputCoeffB.value = 23.5;
            }
        });
    }

    // Listen to saved calibration runs and add to master experimental results
    calib.onRunSaved = (savedRun) => {
        const entry = {
            id: experimentResults.length + 1,
            mode: 'Calibration',
            time: savedRun.time,
            refSpO2: savedRun.refSpO2,
            estSpO2: savedRun.estSpO2,
            absError: savedRun.absError,
            bpm: Math.round(dsp.smoothBPM),
            r: savedRun.r,
            pi: dsp.smoothPI,
            sqi: dsp.sqi
        };
        experimentResults.push(entry);
        renderResultsTable();
    };

    // =========================================================================
    // 10. 3D VIRTUAL LAB CONTROLS & RAYCASTING INSPECTOR
    // =========================================================================
    if (lab3D) {
        // Camera Preset Buttons
        document.querySelectorAll('[data-camera-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-camera-preset]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                lab3D.setCameraPreset(btn.dataset.cameraPreset);
            });
        });

        // 3D Sliders
        const sliderSkinOpacity = document.getElementById('slider-3d-skin-opacity');
        if (sliderSkinOpacity) {
            sliderSkinOpacity.addEventListener('input', (e) => lab3D.setSkinOpacity(e.target.value));
        }

        const sliderClipAngle = document.getElementById('slider-3d-clip-angle');
        if (sliderClipAngle) {
            sliderClipAngle.addEventListener('input', (e) => lab3D.setClipAngle(e.target.value));
        }

        const sliderExploded = document.getElementById('slider-3d-exploded');
        if (sliderExploded) {
            sliderExploded.addEventListener('input', (e) => lab3D.setExplodedView(e.target.value));
        }

        // Raycasting Component Selected Callback
        lab3D.onComponentSelected = (compData) => {
            const panel = document.getElementById('inspector-panel-3d');
            const titleEl = document.getElementById('inspector-comp-title');
            const descEl = document.getElementById('inspector-comp-desc');

            if (panel && titleEl && descEl) {
                titleEl.textContent = compData.name || 'Component Details';
                descEl.textContent = compData.description || 'No description available.';
                panel.style.display = 'block';
            }
        };

        const btnCloseInspector = document.getElementById('btn-close-inspector');
        if (btnCloseInspector) {
            btnCloseInspector.addEventListener('click', () => {
                const panel = document.getElementById('inspector-panel-3d');
                if (panel) panel.style.display = 'none';
            });
        }
    }

    // =========================================================================
    // 11. RESULTS TAB: TABLE RENDERING & FILTERING
    // =========================================================================
    function renderResultsTable(filter = 'ALL') {
        const tbody = document.getElementById('results-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        const filtered = experimentResults.filter(r => filter === 'ALL' || r.mode.toUpperCase() === filter.toUpperCase());

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:24px;">No experimental results recorded yet.</td></tr>';
            return;
        }

        filtered.forEach(r => {
            const tr = document.createElement('tr');
            const errBadgeClass = r.absError <= 2.0 ? 'badge-success' : (r.absError <= 3.5 ? 'badge-warning' : 'badge-danger');
            tr.innerHTML = `
                <td>#${r.id}</td>
                <td><span class="badge ${r.mode === 'Calibration' ? 'badge-info' : 'badge-primary'}">${r.mode}</span></td>
                <td>${r.time}</td>
                <td><strong>${r.refSpO2.toFixed(1)}%</strong></td>
                <td><strong>${r.estSpO2.toFixed(1)}%</strong></td>
                <td><span class="badge ${errBadgeClass}">±${r.absError.toFixed(2)}%</span></td>
                <td>${r.bpm} BPM</td>
                <td>${r.r.toFixed(3)}</td>
                <td>${r.sqi}%</td>
            `;
            tbody.appendChild(tr);
        });

        // Update Statistics Cards
        let totalErr = 0;
        let maxErr = 0;
        let totalSqi = 0;

        filtered.forEach(r => {
            totalErr += r.absError;
            if (r.absError > maxErr) maxErr = r.absError;
            totalSqi += r.sqi;
        });

        const meanErr = filtered.length > 0 ? (totalErr / filtered.length).toFixed(2) : '0.00';
        const meanSqi = filtered.length > 0 ? Math.round(totalSqi / filtered.length) : 0;

        const elTotalRuns = document.getElementById('stat-total-runs');
        const elMeanErr = document.getElementById('stat-mean-error');
        const elMaxErr = document.getElementById('stat-max-error');
        const elMeanSqi = document.getElementById('stat-mean-sqi');

        if (elTotalRuns) elTotalRuns.textContent = filtered.length;
        if (elMeanErr) elMeanErr.textContent = `±${meanErr}%`;
        if (elMaxErr) elMaxErr.textContent = `±${maxErr.toFixed(2)}%`;
        if (elMeanSqi) elMeanSqi.textContent = `${meanSqi}%`;
    }

    renderResultsTable();

    // Results Filter Buttons
    document.querySelectorAll('[data-filter-results]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter-results]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderResultsTable(btn.dataset.filterResults);
        });
    });

    // Record Current Live Simulation Point Button
    const btnRecordLive = document.getElementById('btn-record-live-run');
    if (btnRecordLive) {
        btnRecordLive.addEventListener('click', () => {
            const ref = physics.patient.trueSpO2;
            const est = dsp.smoothSpO2;
            const absErr = Math.abs(est - ref);
            const entry = {
                id: experimentResults.length + 1,
                mode: 'Simulation',
                time: new Date().toLocaleTimeString(),
                refSpO2: ref,
                estSpO2: est,
                absError: absErr,
                bpm: Math.round(dsp.smoothBPM),
                r: dsp.smoothR,
                pi: dsp.smoothPI,
                sqi: dsp.sqi
            };
            experimentResults.push(entry);
            renderResultsTable();

            btnRecordLive.textContent = '✓ Recorded!';
            setTimeout(() => btnRecordLive.textContent = '📥 Record Current Point', 1200);
        });
    }

    // Clear Results Table
    const btnClearResults = document.getElementById('btn-clear-results');
    if (btnClearResults) {
        btnClearResults.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all experimental results?')) {
                experimentResults = [];
                renderResultsTable();
            }
        });
    }

    // =========================================================================
    // 12. EXPORT FUNCTIONALITY: CSV, JSON, PRINT REPORT
    // =========================================================================
    function openExportModal() {
        const modal = document.getElementById('modal-export');
        if (modal) modal.style.display = 'flex';
    }

    function closeExportModal() {
        const modal = document.getElementById('modal-export');
        if (modal) modal.style.display = 'none';
    }

    const btnCloseExport = document.getElementById('btn-close-export');
    if (btnCloseExport) btnCloseExport.addEventListener('click', closeExportModal);

    // Export CSV
    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            let csv = 'Run_ID,Mode,Timestamp,Reference_SpO2_Percent,Estimated_SpO2_Percent,Absolute_Error_Percent,Pulse_Rate_BPM,Ratio_R,Perfusion_Index_Percent,Signal_Quality_SQI\n';
            experimentResults.forEach(r => {
                csv += `${r.id},${r.mode},${r.time},${r.refSpO2.toFixed(1)},${r.estSpO2.toFixed(1)},${r.absError.toFixed(2)},${r.bpm},${r.r.toFixed(3)},${r.pi.toFixed(2)},${r.sqi}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `SpO2_Virtual_Lab_Results_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
        });
    }

    // Export JSON
    const btnExportJSON = document.getElementById('btn-export-json');
    if (btnExportJSON) {
        btnExportJSON.addEventListener('click', () => {
            const data = {
                title: 'SpO2 Circuit Emulation and Calibration Virtual Lab - Experimental Results',
                exportDate: new Date().toISOString(),
                disclaimer: 'Educational conceptual model — not a validated medical device.',
                results: experimentResults
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `SpO2_Virtual_Lab_Results_${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
        });
    }

    // Print Lab Summary Report
    const btnPrintReport = document.getElementById('btn-print-report');
    if (btnPrintReport) {
        btnPrintReport.addEventListener('click', () => {
            window.print();
        });
    }

    // Beginner Tour & Instructions Modal
    const btnOpenHelp = document.getElementById('btn-open-help');
    const modalHelp = document.getElementById('modal-instructions');
    const btnCloseHelp = document.getElementById('btn-close-help');

    if (btnOpenHelp && modalHelp) {
        btnOpenHelp.addEventListener('click', () => modalHelp.style.display = 'flex');
    }
    if (btnCloseHelp && modalHelp) {
        btnCloseHelp.addEventListener('click', () => modalHelp.style.display = 'none');
    }

    // Close modals on clicking overlay backdrop
    window.addEventListener('click', (e) => {
        const modalExp = document.getElementById('modal-export');
        const modalHlp = document.getElementById('modal-instructions');
        if (e.target === modalExp) modalExp.style.display = 'none';
        if (e.target === modalHlp) modalHlp.style.display = 'none';
    });
});
