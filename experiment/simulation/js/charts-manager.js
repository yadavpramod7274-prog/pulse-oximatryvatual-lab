/**
 * charts-manager.js
 * Real-Time Chart.js Visualizations for SpO2 Waveforms & Circuit Scope
 *
 * Implements:
 * 1. Red Channel (660nm) Real-Time Scrolling PPG Waveform
 * 2. Infrared Channel (940nm) Real-Time Scrolling PPG Waveform
 * 3. Processed Combined PPG Waveform with Systolic Peak & Dicrotic Notch Markers
 * 4. Multi-Channel Virtual Oscilloscope for Circuit Test Points (TP1 to TP5)
 */

class ChartsManager {
    constructor() {
        this.maxDataPoints = 180; // Rolling buffer size (~3 seconds at 60fps)

        this.chartRed = null;
        this.chartIR = null;
        this.chartPPG = null;
        this.chartCircuit = null;

        // Active circuit scope test point
        this.activeTestPoint = 'tp4_acRedFiltered';

        this.initCharts();
    }

    initCharts() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js library not loaded');
            return;
        }

        const commonTimeLabels = Array(this.maxDataPoints).fill('');

        // 1. Red Channel Chart (660 nm)
        const canvasRed = document.getElementById('chart-red-canvas');
        if (canvasRed) {
            this.chartRed = new Chart(canvasRed, {
                type: 'line',
                data: {
                    labels: commonTimeLabels,
                    datasets: [{
                        label: 'Red Channel (660 nm) [AC + DC]',
                        data: Array(this.maxDataPoints).fill(1.5),
                        borderColor: '#ff2255',
                        backgroundColor: 'rgba(255, 34, 85, 0.08)',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0,
                        fill: true
                    }]
                },
                options: this.getChartOptions('Amplitude (Volts)', 0.5, 2.5, '#ff2255')
            });
        }

        // 2. Infrared Channel Chart (940 nm)
        const canvasIR = document.getElementById('chart-ir-canvas');
        if (canvasIR) {
            this.chartIR = new Chart(canvasIR, {
                type: 'line',
                data: {
                    labels: commonTimeLabels,
                    datasets: [{
                        label: 'Infrared Channel (940 nm) [AC + DC]',
                        data: Array(this.maxDataPoints).fill(1.6),
                        borderColor: '#00e5ff',
                        backgroundColor: 'rgba(0, 229, 255, 0.08)',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0,
                        fill: true
                    }]
                },
                options: this.getChartOptions('Amplitude (Volts)', 0.5, 2.5, '#00e5ff')
            });
        }

        // 3. Combined Filtered PPG Waveform
        const canvasPPG = document.getElementById('chart-ppg-canvas');
        if (canvasPPG) {
            this.chartPPG = new Chart(canvasPPG, {
                type: 'line',
                data: {
                    labels: commonTimeLabels,
                    datasets: [
                        {
                            label: 'Filtered Plethysmograph (PPG)',
                            data: Array(this.maxDataPoints).fill(0),
                            borderColor: '#38bdf8',
                            backgroundColor: 'rgba(56, 189, 248, 0.15)',
                            borderWidth: 2.5,
                            tension: 0.35,
                            pointRadius: 0,
                            fill: true
                        }
                    ]
                },
                options: this.getChartOptions('AC Voltage (V)', -1.2, 1.2, '#38bdf8')
            });
        }

        // 4. Circuit Lab Multi-Channel Oscilloscope
        const canvasCircuit = document.getElementById('chart-circuit-canvas');
        if (canvasCircuit) {
            this.chartCircuit = new Chart(canvasCircuit, {
                type: 'line',
                data: {
                    labels: commonTimeLabels,
                    datasets: [{
                        label: 'TP4: Active Bandpass Filter Output',
                        data: Array(this.maxDataPoints).fill(1.65),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        borderWidth: 2,
                        tension: 0.25,
                        pointRadius: 0,
                        fill: true
                    }]
                },
                options: this.getChartOptions('Signal Level (V)', -0.5, 3.5, '#f59e0b')
            });
        }
    }

    getChartOptions(yAxisTitle, yMin, yMax, accentColor) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Disabled for high-performance 60fps real-time scrolling
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: {
                    display: false,
                    grid: { display: false }
                },
                y: {
                    title: { display: true, text: yAxisTitle, color: '#94a3b8', font: { size: 10 } },
                    min: yMin,
                    max: yMax,
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: { color: '#94a3b8', font: { size: 9 }, maxTicksLimit: 5 }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: accentColor, boxWidth: 12, font: { size: 11, weight: 'bold' } }
                },
                tooltip: { enabled: false }
            }
        };
    }

    setCircuitTestPoint(tpKey, label, minVal = 0, maxVal = 3.3) {
        this.activeTestPoint = tpKey;
        if (this.chartCircuit) {
            this.chartCircuit.data.datasets[0].label = label;
            this.chartCircuit.options.scales.y.min = minVal;
            this.chartCircuit.options.scales.y.max = maxVal;
            this.chartCircuit.update('none');
        }
    }

    /**
     * Push latest continuous telemetry sample into real-time scrolling charts
     * @param {Object} sample Circuit emulator sample
     * @param {Object} dspMetrics DSP metrics
     */
    updateWaveforms(sample, dspMetrics) {
        // Red Channel Chart: DC baseline + AC pulsatile wave
        if (this.chartRed) {
            const redData = this.chartRed.data.datasets[0].data;
            const vRed = sample.dcRed + sample.tp4_acRedFiltered * 3.0;
            redData.push(vRed);
            if (redData.length > this.maxDataPoints) redData.shift();
            this.chartRed.update('none');
        }

        // IR Channel Chart: DC baseline + AC pulsatile wave
        if (this.chartIR) {
            const irData = this.chartIR.data.datasets[0].data;
            const vIR = sample.dcIR + sample.tp4_acIRFiltered * 3.0;
            irData.push(vIR);
            if (irData.length > this.maxDataPoints) irData.shift();
            this.chartIR.update('none');
        }

        // Combined PPG Plethysmogram Chart
        if (this.chartPPG) {
            const ppgData = this.chartPPG.data.datasets[0].data;
            const vPPG = sample.tp4_acIRFiltered * 15.0; // Scaled for clear visibility
            ppgData.push(vPPG);
            if (ppgData.length > this.maxDataPoints) ppgData.shift();
            this.chartPPG.update('none');
        }

        // Circuit Lab Scope
        if (this.chartCircuit) {
            const circData = this.chartCircuit.data.datasets[0].data;
            let val = 0;
            switch (this.activeTestPoint) {
                case 'tp1_rawPhotodiodeCurrent':
                    val = sample.tp1_rawPhotodiodeCurrent;
                    break;
                case 'tp2_tiaVoltage':
                    val = sample.tp2_tiaVoltage;
                    break;
                case 'tp3_demuxRed':
                    val = sample.tp3_demuxRed;
                    break;
                case 'tp3_demuxIR':
                    val = sample.tp3_demuxIR;
                    break;
                case 'tp4_acRedFiltered':
                    val = sample.tp4_acRedFiltered * 10.0 + 1.65;
                    break;
                case 'tp5_pgaRed':
                    val = sample.tp5_pgaRed;
                    break;
                case 'tp6_adcRed':
                    val = sample.tp6_adcRed;
                    break;
                default:
                    val = sample.tp2_tiaVoltage;
            }
            circData.push(val);
            if (circData.length > this.maxDataPoints) circData.shift();
            this.chartCircuit.update('none');
        }
    }
}

if (typeof window !== 'undefined') {
    window.ChartsManager = ChartsManager;
}
