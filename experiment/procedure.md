### Step-by-Step Experimental Procedure

#### Experiment 1: Exploring the 3D Virtual Laboratory Workspace
1. Launch the virtual laboratory and navigate to the **Simulation** tab.
2. Using mouse or touch controls:
   - **Rotate**: Click and drag with the left mouse button.
   - **Pan**: Drag with the right mouse button (or two-finger touch).
   - **Zoom**: Use the scroll wheel.
3. Switch camera perspectives using the preset pills: `Full Bench`, `Sensor Clip`, `Circuit PCB`, `OLED Display`, and `Top View`.
4. Click on individual 3D components (Finger, Probe Clip, Red/IR LEDs, PIN Photodetector, Amplifier, ADC, Microcontroller, and OLED Display) to inspect their instrumentation functions in the floating inspection card.
5. Experiment with the **X-Ray Opacity**, **Clip Clamp Angle**, and **Exploded View** sliders.

---

#### Experiment 2: Physiological Simulation & Waveform Morphology
1. On the **Simulation** tab, inspect the continuous scrolling waveforms:
   - **Red Channel (660 nm)**
   - **Infrared Channel (940 nm)**
   - **Processed PPG Plethysmogram**
2. Vary the **Simulated Blood Oxygen (SpO₂)** from 98% down to 75%:
   - Notice how the Red waveform AC amplitude expands dramatically at lower SpO₂ because Deoxyhemoglobin absorbs significantly more Red light.
   - Notice how the Modulation Ratio $R$ rises as oxygen saturation decreases.
3. Vary the **Simulated Pulse Rate** (40 to 180 BPM) and **Perfusion Index (PI %)**:
   - Notice how lower perfusion shrinks the AC amplitude and lowers the Signal Quality Index (SQI %).
4. Select different **Clinical Presets** (Healthy 98%, Mild Hypoxia 88%, Severe Hypoxia 74%, Bradycardia, Low Perfusion) and observe the hospital monitor vitals banner.

---

#### Experiment 3: Circuit Parameter Emulation & Hardware Limits
1. Navigate to the **Circuit Lab** tab.
2. In the virtual oscilloscope, switch between test points:
   - `TP1: I_PD` (Raw Photodiode Current)
   - `TP2: V_TIA` (Pre-amp Output)
   - `TP3: Demux` (Demultiplexed Red/IR Signals)
   - `TP4: Filtered` (Active Bandpass Filtered Output)
   - `TP5: ADC` (Quantized Digital Output)
3. Increase the **TIA Feedback Resistor (R_f)** beyond 600 kΩ or increase the **PGA Voltage Gain**:
   - Observe how the op-amp rails clip at $+3.3\text{V}$, triggering the **Op-Amp Clipped** hardware alert.
4. Adjust the **ADC Bit Depth** from 16-bit down to 8-bit:
   - Observe the emergence of discrete staircase quantization noise on the waveform.
5. Toggle **Synchronous Ambient Cancellation** on and off in the presence of high ambient lux to observe 50Hz/60Hz room light hum distortion.

---

#### Experiment 4: Guided 9-Step Empirical Sensor Calibration
1. Navigate to the **Calibration** tab.
2. Execute the 9-step workflow sequentially:
   - **Step 1 (Initialize)**: Verify baseline sensor connection.
   - **Step 2 (Select Reference)**: Choose a reference SpO₂ value (e.g. 98.0%, 90.0%, 85.0%, or custom).
   - **Step 3 (Capture Signals)**: Capture a stable pulse window and compute $(AC/DC)_{660}$ and $(AC/DC)_{940}$.
   - **Step 4 (Calculate Ratio R)**: Calculate the modulation ratio $R = \frac{(AC/DC)_{660}}{(AC/DC)_{940}}$.
   - **Step 5 (Coefficients)**: Select a calibration equation preset (Standard, Nellcor, Masimo) or enter custom $A$ and $B$.
   - **Step 6 (Compare)**: Evaluate the estimated output against the reference target.
   - **Step 7 (Error Analysis)**: Review absolute error and accuracy classification.
   - **Step 8 (Save Run)**: Record the trial point into the data table and update the calibration plot.
   - **Step 9 (Reset / Repeat)**: Repeat the workflow for multiple saturation points (e.g. 98%, 95%, 90%, 85%, 80%, 75%).
3. Observe how experimental calibration points align along the $1:1$ ideal reference line.

---

#### Experiment 5: Results Analysis & Laboratory Reporting
1. Navigate to the **Results** tab.
2. Inspect the summary statistics (Mean Absolute Error, Maximum Error, Average SQI).
3. Export your experimental dataset:
   - Click **Export CSV** to download tabular data.
   - Click **Export JSON** to save structured telemetry.
   - Click **Print Lab Report** to preview a formatted printable summary ready for submission.