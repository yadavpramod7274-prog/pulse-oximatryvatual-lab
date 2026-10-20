### Theory of Pulse Oximetry & Circuit Emulation

#### 1. Introduction
Pulse oximetry is a standard, ubiquitous, non-invasive electro-optical monitoring technique used to estimate arterial hemoglobin oxygen saturation ($\text{SpO}_2$) and heart rate. It combines photoplethysmography (PPG) with spectrophotometry to detect pulsatile changes in arterial blood volume.

#### 2. Photophysical Principles: Beer-Lambert Law
The Beer-Lambert law governs light transmission through absorbing media:
$$I = I_0 \cdot 10^{-\varepsilon(\lambda) \cdot C \cdot d}$$
where:
- $I_0$ is the incident light intensity.
- $I$ is the transmitted light intensity.
- $\varepsilon(\lambda)$ is the molar extinction coefficient at wavelength $\lambda$.
- $C$ is the concentration of the absorbing substance.
- $d$ is the optical pathlength through the tissue.

Human blood primarily consists of two hemoglobin species with distinct optical absorption spectra:
- **Oxygenated Hemoglobin ($\text{HbO}_2$)**: High absorption in the Infrared region ($940\text{ nm}$, $\varepsilon_{\text{HbO}_2} = 0.290$), low absorption in Red ($660\text{ nm}$, $\varepsilon_{\text{HbO}_2} = 0.080$).
- **Deoxygenated Hemoglobin ($\text{Hb}$)**: High absorption in the Red region ($660\text{ nm}$, $\varepsilon_{\text{Hb}} = 0.810$, roughly 10× higher than $\text{HbO}_2$), moderate absorption in Infrared ($940\text{ nm}$, $\varepsilon_{\text{Hb}} = 0.180$).
- **Isosbestic Point ($805\text{ nm}$)**: Point where $\varepsilon_{\text{Hb}} = \varepsilon_{\text{HbO}_2} = 0.200$.

#### 3. Photoplethysmography (PPG) Waveform Decomposition
As light passes through living tissue, the transmitted intensity contains two components:
1. **DC Component ($I_{DC}$)**: Constant attenuation from non-pulsatile venous blood, capillary blood, bone, connective tissue, and skin pigmentation.
2. **AC Component ($I_{AC}$)**: Time-varying attenuation resulting from arterial blood expansion during cardiac ventricular systole.

The normalized optical modulation at wavelength $\lambda$ is:
$$\left(\frac{AC}{DC}\right)_\lambda \approx \frac{\Delta I_\lambda}{I_{DC,\lambda}}$$

#### 4. The Modulation Ratio-of-Ratios ($R$)
To eliminate pathlength $d$ and total blood volume variations, the ratio of normalized modulations between the Red and Infrared channels is calculated:
$$R = \frac{(AC / DC)_{660}}{(AC / DC)_{940}} = \frac{(V_{AC,660} / V_{DC,660})}{(V_{AC,940} / V_{DC,940})}$$

Because light scatters significantly in human skin and tissue, the pure theoretical Beer-Lambert equation deviates from clinical realities. Clinical pulse oximeters map $R$ to $\text{SpO}_2$ using an empirical calibration curve derived from human hypoxia calibration studies:
$$\text{SpO}_2 = A - B \cdot R$$
Typical standard coefficients are $A \approx 110.0$ and $B \approx 25.0$.

#### 5. Electronic Signal Conditioning Architecture
- **Stage 1: Multiplexed LED Drivers**: Drives Red and IR LEDs alternately at 500 Hz with interleaved dark phases.
- **Stage 2: Photodiode & Transimpedance Amplifier (TIA)**: Converts photocurrent $I_{PD}$ to voltage $V_{TIA} = I_{PD} \cdot R_f$.
- **Stage 3: Synchronous Demodulation**: Samples Red, IR, and Dark phases, subtracting dark baseline to cancel ambient room lighting.
- **Stage 4: Active Bandpass Filtering**: High-pass filter ($f_c \approx 0.5\text{ Hz}$) removes DC baseline; 2nd-order low-pass filter ($f_c \approx 8\text{ Hz}$) provides anti-aliasing.
- **Stage 5: PGA & 12-Bit ADC**: Scales signal to 0-3.3V and digitizes with $0.81\text{ mV}$ quantization steps.
- **Stage 6: DSP & Microcontroller**: Peak-valley detection, Ratio $R$ calculation, and OLED readout.

#### 6. Educational Disclaimer
This virtual lab models educational conceptual electronics and synthetic physiology. It does not represent a certified medical diagnostic device.