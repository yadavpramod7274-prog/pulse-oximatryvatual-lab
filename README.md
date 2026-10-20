# SpO₂ Circuit Emulation and Calibration — 3D Virtual Lab

An interactive, high-fidelity **Biomedical Engineering & Electronic Instrumentation Virtual Laboratory** built with HTML5, CSS3, Vanilla JavaScript (ES6+), Three.js, and Chart.js.

This platform emulates the complete electronic analog signal chain, optical tissue absorption physics, digital signal processing (DSP), and empirical calibration workflows of a dual-wavelength transmission pulse oximeter.

---

## 🏛️ Virtual Labs Metadata

| Attribute | Details |
|:---|:---|
| **Discipline** | Biomedical Engineering / Electronics & Communication Engineering |
| **Lab** | Biomedical Instrumentation & Signal Processing Virtual Lab |
| **Experiment Name** | SpO₂ Circuit Emulation and Calibration — 3D Virtual Lab |
| **Developer** | Pramod Yadav |
| **Institute** | Rajkiya Engineering College Banda (REC Banda) |
| **Department** | Information Technology |
| **Email ID** | 2507340130044@recbanda.ac.in |

### Contributors List

| SrNo | Name | Faculty or Student | Department | Institute | Email ID |
|:---|:---|:---|:---|:---|:---|
| 1 | Pramod Yadav | Student | Information Technology | Rajkiya Engineering College Banda | 2507340130044@recbanda.ac.in |

---

## 🌟 Key Features

### 1. Interactive 3D Virtual Reality Lab (`js/virtual-lab-3d.js`)
- **Realistic 3D Sensor Probe Clip**:
  - Medical clamshell clip with spring hinge articulation.
  - Dual LED optical emitters (660 nm Red & 940 nm Infrared) in top housing with dynamic optical glow.
  - Silicon PIN photodetector optical window in bottom housing.
  - Exploded assembly view slider ($0\% - 100\%$) separating components in 3D space.
- **3D Anatomical Finger with Hemodynamic Pulsation**:
  - Translucent tissue with adjustable X-Ray opacity slider ($0\% - 100\%$).
  - Internal phalanx bone structure (distal & middle phalanx).
  - Lateral digital arteries that pulse dynamically in 3D with each systolic ejection wave.
- **Integrated Circuit PCB Bench**:
  - 3D Signal Conditioning Amplifier block (OPA320 TIA op-amp package, gain pot, and feedback components).
  - 3D Analog-to-Digital Converter (ADC) chip block (ADS1115 / 12-bit SAR ADC).
  - 3D Microcontroller block (ARM Cortex / STM32) with clock crystal and pinouts.
  - 3D OLED-Style SpO₂ Display module with live dynamic canvas texture displaying real-time SpO₂ %, BPM, and mini pleth wave in 3D space!
- **Connecting Wires & Animated Conceptual Signal Path**:
  - Ribbon cables and copper traces connecting sensor $\to$ amplifier $\to$ ADC $\to$ MCU $\to$ OLED.
  - Animated glowing optical photons propagating through tissue and glowing electrical signal pulses traveling through wires.
- **Full OrbitControls & Camera Presets**:
  - Rotate, Zoom, and Pan.
  - Camera presets: Full Bench, Sensor Clip, Circuit PCB, OLED Screen, Top View.
  - Interactive raycasting: click any 3D component to inspect its function and biomedical principles.

### 2. Block-Level Circuit Emulation (`js/circuit-emulator.js`)
- **Stage 1: LED Driver & Timing Multiplexer**:
  - 660 nm Red and 940 nm IR channel drive currents ($5 - 50\text{ mA}$).
  - Non-overlapping 4-phase clock ($500\text{ Hz}$): Red ON $\to$ Dark 1 $\to$ IR ON $\to$ Dark 2.
- **Stage 2: Photodiode & Transimpedance Amplifier (TIA)**:
  - Silicon PIN photodiode responsivity ($\mathcal{R}_{660} = 0.45\text{ A/W}$, $\mathcal{R}_{940} = 0.65\text{ A/W}$).
  - $V_{TIA} = I_{PD} \cdot R_f$ with adjustable feedback resistor ($50\text{ k}\Omega - 1000\text{ k}\Omega$).
  - Op-amp saturation detection against $+3.3\text{V}$ power rails.
- **Stage 3: Demultiplexer & Ambient Light Cancellation**:
  - Synchronous demodulation subtracting ambient stray light: $V_{demux} = V_{sample} - V_{dark}$.
- **Stage 4: Active Bandpass Filtering**:
  - Active High-Pass Filter ($f_c \approx 0.5\text{ Hz}$) removes DC baseline.
  - 2nd-order Sallen-Key Low-Pass Filter ($f_c \approx 8\text{ Hz}$) suppresses $50/60\text{ Hz}$ mains interference.
- **Stage 5: Programmable Gain Amplifier (PGA) & ADC Discretization**:
  - Selectable ADC resolution: 8-bit, 10-bit, 12-bit, 16-bit (shows quantization step size $\Delta V$).
  - Selectable sampling rate: 50 Hz, 100 Hz, 250 Hz, 500 Hz, 1000 Hz.

### 3. SpO₂ & Pulse Signal Simulation (`js/physics-engine.js` & `js/dsp-processor.js`)
- **Physiological Parameter Controls**:
  - Simulated SpO₂ % ($70\% - 100\%$, default $98\%$)
  - Simulated Pulse Rate ($40 - 180\text{ BPM}$, default $75\text{ BPM}$)
  - Perfusion Index ($0.2\% - 10\%$, default $2.5\%$)
  - Signal noise, respiration baseline wander, and motion tremor.
  - Clinical presets: Normal Healthy, Mild Hypoxia, Severe Hypoxia, Bradycardia, Low Perfusion.
- **Real-Time Chart.js Continuous Waveforms**:
  - Red Channel Waveform (660 nm) with pulsatile AC and DC baseline.
  - Infrared Channel Waveform (940 nm) with pulsatile AC and DC baseline.
  - Combined Filtered PPG Waveform with systolic peak and dicrotic notch markers.
- **Live Hospital Monitor Telemetry**:
  - Target vs Estimated SpO₂ readout.
  - Pulse Rate (BPM) with pulsating heart icon.
  - Modulation Ratio $R = \frac{(AC/DC)_{660}}{(AC/DC)_{940}}$.
  - Perfusion Index ($PI\%$) and Signal Quality Index ($SQI\%$).
  - Dynamic Plethysmograph vertical bar.
  - Authentic Web Audio API cardiac pulse beeps (pitch proportional to SpO₂).

### 4. Interactive 9-Step Calibration Laboratory (`js/calibration-studio.js`)
1. **Initialize simulation**: Reset sensor and verify baseline perfusion.
2. **Select reference SpO₂**: Choose standard calibration points (70% to 100% or custom input).
3. **Capture synthetic signals**: Extract $AC_{660}$, $DC_{660}$, $AC_{940}$, $DC_{940}$.
4. **Calculate Ratio-of-Ratios ($R$)**: Compute $R = \frac{(AC/DC)_{660}}{(AC/DC)_{940}}$ with full step-by-step math.
5. **Set calibration coefficients**: Select standard commercial, Nellcor, Masimo presets, or custom $A$ and $B$.
6. **Compare output**: Contrast formula-estimated SpO₂ with the reference target.
7. **Compute errors**: Calculate absolute error $|\text{Est} - \text{Ref}|$ and percentage-point difference.
8. **Save calibration run**: Add data point to results table and update the Chart.js calibration graph.
9. **Reset / Repeat**: Repeat for multiple synthetic reference points.
- **Chart.js Calibration Plot**: Reference SpO₂ vs Estimated SpO₂ with $1:1$ ideal reference line and scatter points.

### 5. Experimental Results Logging & Export
- Tabular record of all simulation and calibration trials.
- Real-time statistics: Total Runs, Mean Absolute Error, Maximum Error, Mean SQI.
- Export options:
  - **Export CSV** (Excel / MATLAB compatible)
  - **Export JSON** (Structured data with metadata)
  - **Print Lab Report** (Formatted printable PDF report)

---

## 🚀 Running the Project Locally

No build step or bundler is required. The project runs directly in any modern web browser.

### Option 1: Direct File Opening
Double-click `index.html` at the repository root or open `experiment/simulation/index.html` in Chrome, Firefox, Edge, or Safari.

### Option 2: Local Python HTTP Server
Run from the repository root:
```bash
python -m http.server 8000
```
Then visit: `http://localhost:8000/`

---

## 🌐 GitHub Pages Deployment

The repository is fully configured for GitHub Pages:
1. Go to your repository on GitHub: `https://github.com/yadavpramod7274-prog/pulse-oximatryvatual-lab`
2. Navigate to **Settings** > **Pages**.
3. Under **Build and deployment** > **Branch**, select `main` branch and `/ (root)` folder.
4. Click **Save**.
5. Your lab will be live at: `https://yadavpramod7274-prog.github.io/pulse-oximatryvatual-lab/`

---

## ⚠️ Educational Disclaimer

This software is an educational simulation designed solely for academic and training purposes in biomedical instrumentation. It is **NOT** a certified medical device and must never be used for clinical diagnosis, patient monitoring, or treatment decisions.
