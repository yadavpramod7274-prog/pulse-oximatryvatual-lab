/**
 * virtual-lab-3d.js
 * Interactive 3D WebGL Virtual Laboratory for Pulse Oximetry
 * Powered by Three.js & OrbitControls
 *
 * Implements:
 * 1. Realistic Pulse Oximeter Sensor Clip with Red (660nm) & IR (940nm) LED indicators
 * 2. Anatomical Finger Model with translucent tissue, phalanx bone, and pulsating digital arteries
 * 3. Silicon PIN Photodetector window
 * 4. Signal Conditioning Amplifier circuit block (TIA & Active Filter)
 * 5. Analog-to-Digital Converter (ADC) chip block
 * 6. Microcontroller (DSP Processor) chip block
 * 7. OLED-Style SpO2 Display with dynamic real-time canvas texture (shows live SpO2, BPM & Pleth wave)
 * 8. Connecting wires and PCB copper traces linking all blocks
 * 9. Animated conceptual signal path from sensor to display (photons & electrical signal pulses)
 * 10. Interactive raycasting selection with detailed technical component inspection panels
 * 11. OrbitControls (Rotate, Zoom, Pan) + 5 Camera Presets
 * 12. Exploded Assembly View and Finger X-Ray Translucency controls
 *
 * Educational conceptual model — not a validated medical device.
 */

class PulseOximetry3DLab {
    constructor(containerId, physicsEngine, circuitEmulator, dspProcessor) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`3D Container #${containerId} not found`);
            return;
        }

        this.physics = physicsEngine;
        this.circuit = circuitEmulator;
        this.dsp = dspProcessor;

        // Interactive Options
        this.options = {
            skinOpacity: 0.65,
            clipOpenAngle: 0.0,      // Radians
            explodedView: 0.0,       // 0.0 to 1.0
            showPhotons: true,
            showSignalFlow: true,
            isPulsing: true
        };

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        // 3D Hierarchical Groups
        this.rootGroup = new THREE.Group();
        this.benchGroup = new THREE.Group();
        this.sensorGroup = new THREE.Group();
        this.circuitGroup = new THREE.Group();
        this.signalPathGroup = new THREE.Group();

        // Components & Meshes for animation/interaction
        this.clipTopArm = null;
        this.clipBottomArm = null;
        this.springMesh = null;
        this.fingerMesh = null;
        this.skinMaterial = null;
        this.boneMesh = null;
        this.arteries = [];
        this.ledRedMesh = null;
        this.ledIRMesh = null;
        this.photodetectorMesh = null;
        this.amplifierMesh = null;
        this.adcMesh = null;
        this.mcuMesh = null;
        this.oledScreenMesh = null;
        this.cableCurve = null;
        this.signalParticles = [];

        // Dynamic OLED Canvas Texture
        this.oledCanvas = null;
        this.oledCtx = null;
        this.oledTexture = null;

        // Raycasting for component selection
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactiveComponents = [];
        this.selectedComponent = null;

        // Callback for component selection
        this.onComponentSelected = null;

        this.init();
    }

    init() {
        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 520;

        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060b18);
        this.scene.fog = new THREE.FogExp2(0x060b18, 0.009);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(24, 20, 32);

        // 3. WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // 4. OrbitControls
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxDistance = 150;
            this.controls.minDistance = 8;
            this.controls.target.set(0, 3, 0);
        }

        // 5. Lighting
        this.setupLighting();

        // 6. Build OLED Dynamic Texture
        this.initOLEDTexture();

        // 7. Build 3D Models
        this.buildLabBench();
        this.buildSensorAndFingerModel();
        this.buildCircuitPCBModel();
        this.buildConnectingWires();
        this.buildSignalFlowParticles();

        this.rootGroup.add(this.benchGroup);
        this.rootGroup.add(this.sensorGroup);
        this.rootGroup.add(this.circuitGroup);
        this.rootGroup.add(this.signalPathGroup);
        this.scene.add(this.rootGroup);

        // Center entire assembly
        this.sensorGroup.position.set(-16, 2.5, 0);
        this.circuitGroup.position.set(10, 0, 0);

        // 8. Event Listeners & Raycasting
        window.addEventListener('resize', () => this.onWindowResize());
        this.setupRaycasting();

        // 9. Animation Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupLighting() {
        // Deep blue lab ambient
        const ambient = new THREE.AmbientLight(0x1a2942, 1.4);
        this.scene.add(ambient);

        // Main overhead exam spotlight
        const spot = new THREE.SpotLight(0xffffff, 2.6);
        spot.position.set(20, 50, 30);
        spot.angle = Math.PI / 4.2;
        spot.penumbra = 0.45;
        spot.castShadow = true;
        spot.shadow.mapSize.width = 1024;
        spot.shadow.mapSize.height = 1024;
        this.scene.add(spot);

        // Cyan biomedical rim light
        const cyanRim = new THREE.DirectionalLight(0x00f2fe, 1.2);
        cyanRim.position.set(-30, 18, -25);
        this.scene.add(cyanRim);

        // Warm arterial glow light from bottom
        const warmFill = new THREE.PointLight(0xff3366, 1.0, 25);
        warmFill.position.set(-16, 1, 0);
        this.scene.add(warmFill);
    }

    /**
     * Laboratory Bench Floor & Grid
     */
    buildLabBench() {
        // Antistatic ESD Lab Mat
        const matGeo = new THREE.BoxGeometry(72, 1.0, 48);
        const matMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a1426,
            roughness: 0.85,
            metalness: 0.1
        });
        const matMesh = new THREE.Mesh(matGeo, matMaterial);
        matMesh.position.y = -0.5;
        matMesh.receiveShadow = true;
        this.benchGroup.add(matMesh);

        // Grid lines
        const grid = new THREE.GridHelper(70, 35, 0x00f2fe, 0x152846);
        grid.position.y = 0.02;
        this.benchGroup.add(grid);
    }

    /**
     * Dynamic 2D Canvas mapped as a live texture onto the 3D OLED screen
     */
    initOLEDTexture() {
        this.oledCanvas = document.createElement('canvas');
        this.oledCanvas.width = 256;
        this.oledCanvas.height = 128;
        this.oledCtx = this.oledCanvas.getContext('2d');

        this.oledTexture = new THREE.CanvasTexture(this.oledCanvas);
        this.oledTexture.minFilter = THREE.LinearFilter;
        this.oledTexture.magFilter = THREE.LinearFilter;
        this.updateOLEDTexture(98, 75, 0.5);
    }

    updateOLEDTexture(spo2Val, bpmVal, wavePhase = 0) {
        if (!this.oledCtx) return;
        const ctx = this.oledCtx;
        const w = 256;
        const h = 128;

        // OLED Black Background
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, w, h);

        // Glowing Blue Bezel Header
        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillText('SpO2 MONITOR [LIVE]', 12, 18);

        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText('DSP v2.5', 200, 18);

        // SpO2 Large Cyan Readout
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
        const sVal = (typeof spo2Val === 'number') ? spo2Val.toFixed(0) : '98';
        ctx.fillText(sVal, 14, 62);

        ctx.font = 'bold 14px "Segoe UI", sans-serif';
        ctx.fillText('%', 64, 46);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillText('O2 SAT', 14, 76);

        // Pulse Rate Amber Readout
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
        const bVal = (typeof bpmVal === 'number') ? Math.round(bpmVal) : '75';
        ctx.fillText(bVal, 105, 58);

        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillText('BPM', 152, 46);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillText('PULSE', 105, 76);

        // Mini Live Waveform at bottom
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 12; x < w - 12; x++) {
            const phase = ((x / 60.0) + wavePhase * 4.0) % (Math.PI * 2);
            const y = 104 - Math.sin(phase) * 14 - (Math.sin(phase * 2) > 0 ? Math.sin(phase * 2) * 6 : 0);
            if (x === 12) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        this.oledTexture.needsUpdate = true;
    }

    /**
     * 1. Sensor Clip & Anatomical Human Finger
     */
    buildSensorAndFingerModel() {
        const probeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.1 });
        const cushionMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });

        // A. TOP CLAMSHELL (Holds Red & IR LEDs)
        this.clipTopArm = new THREE.Group();
        this.clipTopArm.position.set(0, 3.2, 0);

        const topShellGeo = new THREE.BoxGeometry(15, 2.2, 8);
        const topShell = new THREE.Mesh(topShellGeo, probeMat);
        topShell.position.set(2, 0, 0);
        topShell.castShadow = true;
        this.clipTopArm.add(topShell);

        const topCushionGeo = new THREE.CylinderGeometry(3.6, 3.6, 11, 16, 1, false, 0, Math.PI);
        const topCushion = new THREE.Mesh(topCushionGeo, cushionMat);
        topCushion.rotation.z = Math.PI / 2;
        topCushion.rotation.x = Math.PI;
        topCushion.position.set(2, -1.0, 0);
        this.clipTopArm.add(topCushion);

        // Red LED (660nm)
        const ledGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.9, 16);
        this.ledRedMat = new THREE.MeshStandardMaterial({
            color: 0xff2255,
            emissive: 0xff1144,
            emissiveIntensity: 1.8,
            roughness: 0.2
        });
        this.ledRedMesh = new THREE.Mesh(ledGeo, this.ledRedMat);
        this.ledRedMesh.position.set(0, -1.2, -1.5);
        this.clipTopArm.add(this.ledRedMesh);

        // IR LED (940nm)
        this.ledIRMat = new THREE.MeshStandardMaterial({
            color: 0x00e5ff,
            emissive: 0x00c8e6,
            emissiveIntensity: 1.8,
            roughness: 0.2
        });
        this.ledIRMesh = new THREE.Mesh(ledGeo, this.ledIRMat);
        this.ledIRMesh.position.set(0, -1.2, 1.5);
        this.clipTopArm.add(this.ledIRMesh);

        // B. BOTTOM CLAMSHELL (Holds Photodetector)
        this.clipBottomArm = new THREE.Group();
        this.clipBottomArm.position.set(0, -3.2, 0);

        const bottomShellGeo = new THREE.BoxGeometry(15, 2.2, 8);
        const bottomShell = new THREE.Mesh(bottomShellGeo, probeMat);
        bottomShell.position.set(2, 0, 0);
        bottomShell.castShadow = true;
        this.clipBottomArm.add(bottomShell);

        const bottomCushionGeo = new THREE.CylinderGeometry(3.6, 3.6, 11, 16, 1, false, 0, Math.PI);
        const bottomCushion = new THREE.Mesh(bottomCushionGeo, cushionMat);
        bottomCushion.rotation.z = Math.PI / 2;
        bottomCushion.position.set(2, 1.0, 0);
        this.clipBottomArm.add(bottomCushion);

        // Silicon PIN Photodetector
        const pdGeo = new THREE.BoxGeometry(3.5, 0.45, 3.5);
        this.pdMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            emissive: 0x0284c7,
            emissiveIntensity: 0.5,
            roughness: 0.1,
            metalness: 0.85
        });
        this.photodetectorMesh = new THREE.Mesh(pdGeo, this.pdMat);
        this.photodetectorMesh.position.set(0, 1.2, 0);
        this.clipBottomArm.add(this.photodetectorMesh);

        // C. HINGE & SPRING
        const hinge = new THREE.Group();
        hinge.position.set(-5.5, 0, 0);

        const pinGeo = new THREE.CylinderGeometry(0.8, 0.8, 8.4, 16);
        const pinMesh = new THREE.Mesh(pinGeo, metalMat);
        pinMesh.rotation.x = Math.PI / 2;
        hinge.add(pinMesh);

        const springGeo = new THREE.TorusGeometry(1.5, 0.32, 12, 24);
        this.springMesh = new THREE.Mesh(springGeo, metalMat);
        this.springMesh.rotation.y = Math.PI / 2;
        hinge.add(this.springMesh);

        this.sensorGroup.add(hinge);
        this.sensorGroup.add(this.clipTopArm);
        this.sensorGroup.add(this.clipBottomArm);

        // D. ANATOMICAL HUMAN FINGER
        this.fingerGroup = new THREE.Group();

        // Finger tissue (Translucent skin)
        const skinGeo = new THREE.CylinderGeometry(2.4, 2.8, 20, 24, 8);
        this.skinMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xdf9b76,
            roughness: 0.45,
            metalness: 0.05,
            transmission: 0.35,
            transparent: true,
            opacity: this.options.skinOpacity,
            ior: 1.4
        });
        this.fingerMesh = new THREE.Mesh(skinGeo, this.skinMaterial);
        this.fingerMesh.rotation.z = Math.PI / 2;
        this.fingerMesh.position.set(-1.0, 0, 0);
        this.fingerMesh.castShadow = true;
        this.fingerGroup.add(this.fingerMesh);

        // Fingernail
        const nailGeo = new THREE.CylinderGeometry(1.6, 1.7, 4.8, 16, 1, false, 0, Math.PI * 0.7);
        const nailMat = new THREE.MeshStandardMaterial({ color: 0xfde2d2, roughness: 0.25, metalness: 0.1 });
        const nailMesh = new THREE.Mesh(nailGeo, nailMat);
        nailMesh.rotation.z = Math.PI / 2;
        nailMesh.rotation.x = -Math.PI / 2 - 0.5;
        nailMesh.position.set(4.0, 1.95, 0);
        this.fingerGroup.add(nailMesh);

        // Phalanx Bone (Distal & Middle)
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xf6f0dd, roughness: 0.5 });
        const boneGeo = new THREE.CylinderGeometry(0.85, 1.05, 16, 16);
        this.boneMesh = new THREE.Mesh(boneGeo, boneMat);
        this.boneMesh.rotation.z = Math.PI / 2;
        this.boneMesh.position.set(-1.0, 0, 0);
        this.fingerGroup.add(this.boneMesh);

        // Pulsating Digital Arteries (Left and Right)
        this.arteries = [];
        const arteryMat = new THREE.MeshStandardMaterial({
            color: 0xdc2626,
            emissive: 0xef4444,
            emissiveIntensity: 0.8,
            roughness: 0.3
        });
        [-1.5, 1.5].forEach(zPos => {
            const artGeo = new THREE.CylinderGeometry(0.42, 0.42, 17, 16);
            const artMesh = new THREE.Mesh(artGeo, arteryMat);
            artMesh.rotation.z = Math.PI / 2;
            artMesh.position.set(-1.0, -0.6, zPos);
            this.fingerGroup.add(artMesh);
            this.arteries.push(artMesh);
        });

        this.sensorGroup.add(this.fingerGroup);

        // Register interactive meshes for raycasting
        this.registerInteractive(topShell, 'Sensor Clip (Top Housing)', 'Mechanical clamshell housing the dual 660nm Red and 940nm IR emitter LEDs with shielding against ambient stray light.');
        this.registerInteractive(bottomShell, 'Sensor Clip (Bottom Housing)', 'Mechanical clamshell housing the wide-area silicon PIN photodiode optical detector and cable strain relief.');
        this.registerInteractive(this.fingerMesh, 'Human Vascular Tissue', 'Arterial blood pulsates with each cardiac systole, causing time-varying differential optical absorption governed by the Beer-Lambert law.');
        this.registerInteractive(this.ledRedMesh, 'Red Optical Emitter LED (660 nm)', 'Emits at nominal 660 nm where Deoxyhemoglobin (Hb) exhibits ~10x greater optical absorption than Oxyhemoglobin (HbO2).');
        this.registerInteractive(this.ledIRMesh, 'Infrared Emitter LED (940 nm)', 'Emits at nominal 940 nm where Oxyhemoglobin (HbO2) exhibits higher optical absorption than Deoxyhemoglobin (Hb).');
        this.registerInteractive(this.photodetectorMesh, 'Silicon PIN Photodetector', 'Transduces transmitted optical photon flux into microampere electric current (I_PD) with peak quantum responsivity across 600-1000 nm.');
    }

    /**
     * 2. Electronic Circuit PCB & Modules
     */
    buildCircuitPCBModel() {
        // PCB Substrate (FR4 Navy Blue / Dark Green)
        const pcbGeo = new THREE.BoxGeometry(28, 1.0, 20);
        const pcbMat = new THREE.MeshStandardMaterial({
            color: 0x082f49, // Dark scientific navy FR4
            roughness: 0.35,
            metalness: 0.15
        });
        const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
        pcbMesh.position.y = 0.5;
        pcbMesh.receiveShadow = true;
        this.circuitGroup.add(pcbMesh);

        // Copper Mounting Holes
        const holeGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.1, 16);
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.15 });
        [[-12, -8], [12, -8], [-12, 8], [12, 8]].forEach(([hx, hz]) => {
            const h = new THREE.Mesh(holeGeo, goldMat);
            h.position.set(hx, 0.5, hz);
            this.circuitGroup.add(h);
        });

        // A. Signal Conditioning Amplifier (TIA + Active Filter) Block
        this.amplifierMesh = this.addICModule(this.circuitGroup, -7, 1.0, -4, 6, 5, 'AMP (OPA320)', 'Signal Conditioning Amplifier', 'Transimpedance amplifier converts photodiode current (I_PD) to voltage (V_TIA = I_PD * Rf), followed by active bandpass filtering.');

        // B. Analog-to-Digital Converter (ADC) Chip Block
        this.adcMesh = this.addICModule(this.circuitGroup, 1, 1.0, -4, 5, 4.5, 'ADC (12-Bit)', 'Analog-to-Digital Converter (ADC)', 'Discretizes analog PPG signal into 12-bit digital quantization steps (0-4095 counts) at user-selected sampling rates.');

        // C. Microcontroller (DSP Processor) Block
        this.mcuMesh = this.addICModule(this.circuitGroup, 8, 1.0, 0, 7, 7, 'MCU (ARM Cortex)', 'Microcontroller DSP Engine', 'Executes peak-detection algorithm, calculates Modulation Ratio R = (AC_red/DC_red) / (AC_ir/DC_ir), estimates SpO2, and drives the OLED display.');

        // D. OLED-Style SpO2 Display Module
        const oledBaseGeo = new THREE.BoxGeometry(9.5, 0.8, 6.5);
        const oledBaseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
        const oledBase = new THREE.Mesh(oledBaseGeo, oledBaseMat);
        oledBase.position.set(-4, 1.4, 4.5);
        this.circuitGroup.add(oledBase);

        // Glass OLED Screen with Dynamic Canvas Texture
        const screenGeo = new THREE.PlaneGeometry(8.5, 5.2);
        const screenMat = new THREE.MeshBasicMaterial({ map: this.oledTexture, toneMapped: false });
        this.oledScreenMesh = new THREE.Mesh(screenGeo, screenMat);
        this.oledScreenMesh.rotation.x = -Math.PI / 2;
        this.oledScreenMesh.position.set(-4, 1.85, 4.5);
        this.circuitGroup.add(this.oledScreenMesh);

        this.registerInteractive(this.oledScreenMesh, 'OLED SpO2 Display', 'Real-time graphic display rendering live digitized SpO2 percentage, pulse rate (BPM), and continuous photoplethysmograph (PPG) waveforms.');
    }

    addICModule(parent, x, y, z, sx, sz, label, fullName, description) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const bodyGeo = new THREE.BoxGeometry(sx, 0.85, sz);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.42;
        body.castShadow = true;
        group.add(body);

        // Silver Pins
        const pinMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
        const numPins = 4;
        for (let i = 0; i < numPins; i++) {
            const px = -sx / 2 + 0.8 + (i * (sx - 1.6)) / (numPins - 1);
            [-sz / 2 - 0.3, sz / 2 + 0.3].forEach(pz => {
                const pin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.6), pinMat);
                pin.position.set(px, 0.1, pz);
                group.add(pin);
            });
        }

        // Notch / Pin 1 indicator
        const dotGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(-sx / 2 + 0.8, 0.86, -sz / 2 + 0.8);
        group.add(dot);

        parent.add(group);
        this.registerInteractive(body, fullName, description);
        return body;
    }

    /**
     * 3. Connecting Wires & PCB Traces
     */
    buildConnectingWires() {
        const wireMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.5 });
        const goldTraceMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });

        // Flexible sensor probe cable connecting sensor clip to PCB
        const points = [
            new THREE.Vector3(-16, 2.5, 0),
            new THREE.Vector3(-10, 4.0, -3),
            new THREE.Vector3(-2, 1.5, -4),
            new THREE.Vector3(3, 1.1, -4)
        ];
        this.cableCurve = new THREE.CatmullRomCurve3(points);
        const cableGeo = new THREE.TubeGeometry(this.cableCurve, 32, 0.38, 12, false);
        const cableMesh = new THREE.Mesh(cableGeo, wireMat);
        this.benchGroup.add(cableMesh);

        // Ribbon wires connecting Amplifier -> ADC -> MCU -> OLED
        const tracePaths = [
            // AMP to ADC
            [new THREE.Vector3(3, 1.1, -4), new THREE.Vector3(11, 1.1, -4)],
            // ADC to MCU
            [new THREE.Vector3(11, 1.1, -4), new THREE.Vector3(18, 1.1, 0)],
            // MCU to OLED
            [new THREE.Vector3(18, 1.1, 0), new THREE.Vector3(6, 1.1, 4.5)]
        ];

        tracePaths.forEach(([p1, p2]) => {
            const curve = new THREE.LineCurve3(p1, p2);
            const tube = new THREE.TubeGeometry(curve, 16, 0.22, 8, false);
            const traceMesh = new THREE.Mesh(tube, goldTraceMat);
            this.benchGroup.add(traceMesh);
        });

        this.registerInteractive(cableMesh, 'Connecting Wires & Data Bus', 'Shielded cable harness delivering analog photodiode signals to the pre-amp, and SPI/I2C digital buses interconnecting ADC, MCU, and OLED display.');
    }

    /**
     * 4. Animated Conceptual Signal Path Particles
     */
    buildSignalFlowParticles() {
        // Photon emission particles in finger
        const photonCount = 40;
        const photonGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(photonCount * 3);
        const colors = new Float32Array(photonCount * 3);

        for (let i = 0; i < photonCount; i++) {
            positions[i * 3 + 0] = -16 + (Math.random() - 0.5) * 4;
            positions[i * 3 + 1] = 2.5 + (Math.random() - 0.5) * 3;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 3;

            if (i % 2 === 0) {
                // Red photons (660nm)
                colors[i * 3 + 0] = 1.0;
                colors[i * 3 + 1] = 0.1;
                colors[i * 3 + 2] = 0.3;
            } else {
                // IR photons (940nm)
                colors[i * 3 + 0] = 0.0;
                colors[i * 3 + 1] = 0.9;
                colors[i * 3 + 2] = 1.0;
            }
        }

        photonGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        photonGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const photonMat = new THREE.PointsMaterial({
            size: 0.55,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });

        this.photonPoints = new THREE.Points(photonGeo, photonMat);
        this.signalPathGroup.add(this.photonPoints);

        // Electrical signal packets traveling along the circuit path
        this.signalPackets = [];
        const packetMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
        const packetGeo = new THREE.SphereGeometry(0.35, 12, 12);

        for (let i = 0; i < 6; i++) {
            const p = new THREE.Mesh(packetGeo, packetMat);
            p.userData = { progress: i / 6.0 };
            this.signalPathGroup.add(p);
            this.signalPackets.push(p);
        }
    }

    registerInteractive(mesh, name, description) {
        if (!mesh) return;
        mesh.userData = { isInteractive: true, name, description };
        this.interactiveComponents.push(mesh);
    }

    setupRaycasting() {
        this.container.addEventListener('click', (e) => {
            const rect = this.container.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.interactiveComponents, true);

            if (intersects.length > 0) {
                const hit = intersects[0].object;
                const data = hit.userData;
                if (data && data.name) {
                    this.highlightComponent(hit);
                    if (this.onComponentSelected && typeof this.onComponentSelected === 'function') {
                        this.onComponentSelected(data);
                    }
                }
            }
        });
    }

    highlightComponent(mesh) {
        if (this.selectedComponent && this.selectedComponent.material && this.selectedComponent.material.emissive) {
            this.selectedComponent.material.emissive.setHex(this.selectedComponent.userData.origEmissive || 0x000000);
        }

        this.selectedComponent = mesh;
        if (mesh && mesh.material && mesh.material.emissive) {
            if (mesh.userData.origEmissive === undefined) {
                mesh.userData.origEmissive = mesh.material.emissive.getHex();
            }
            mesh.material.emissive.setHex(0x00f2fe);
        }
    }

    /**
     * Camera View Presets
     */
    setCameraPreset(presetName) {
        if (!this.camera || !this.controls) return;

        switch (presetName) {
            case 'BENCH':
                this.camera.position.set(24, 20, 32);
                this.controls.target.set(0, 3, 0);
                break;
            case 'SENSOR':
                this.camera.position.set(-16, 12, 18);
                this.controls.target.set(-16, 2.5, 0);
                break;
            case 'CIRCUIT':
                this.camera.position.set(10, 16, 20);
                this.controls.target.set(10, 2, 0);
                break;
            case 'OLED':
                this.camera.position.set(6, 10, 14);
                this.controls.target.set(6, 2, 4.5);
                break;
            case 'TOP':
                this.camera.position.set(0, 48, 0.1);
                this.controls.target.set(0, 0, 0);
                break;
        }
        this.controls.update();
    }

    setSkinOpacity(val) {
        this.options.skinOpacity = parseFloat(val);
        if (this.skinMaterial) {
            this.skinMaterial.opacity = this.options.skinOpacity;
            this.skinMaterial.needsUpdate = true;
        }
    }

    setClipAngle(degrees) {
        const rad = (parseFloat(degrees) * Math.PI) / 180.0;
        this.options.clipOpenAngle = rad;
        if (this.clipTopArm && this.clipBottomArm) {
            this.clipTopArm.rotation.z = -rad;
            this.clipBottomArm.rotation.z = rad * 0.5;
        }
    }

    setExplodedView(val) {
        const f = Math.max(0.0, Math.min(1.0, parseFloat(val)));
        this.options.explodedView = f;
        if (this.clipTopArm) this.clipTopArm.position.y = 3.2 + f * 5.0;
        if (this.clipBottomArm) this.clipBottomArm.position.y = -3.2 - f * 5.0;
        if (this.fingerMesh) this.fingerMesh.position.x = -1.0 - f * 6.0;
    }

    onWindowResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Animation Loop
     */
    animate() {
        requestAnimationFrame(this.animate);
        const dt = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        if (this.controls) this.controls.update();

        // 1. Dynamic Arterial Pulsation in 3D Finger
        if (this.options.isPulsing && this.physics) {
            const cardiacPhase = this.physics.cardiacPhase || (time % 1.0);
            const pulseAmp = this.physics.synthesizeSinglePulse(cardiacPhase);

            // Arteries expand with systolic pulse
            const artScale = 1.0 + pulseAmp * 0.35;
            this.arteries.forEach(art => {
                art.scale.set(artScale, 1.0, artScale);
            });

            // LED Emitter indicators glow in sync
            if (this.ledRedMat) {
                this.ledRedMat.emissiveIntensity = 1.2 + pulseAmp * 1.5;
            }
            if (this.ledIRMat) {
                this.ledIRMat.emissiveIntensity = 1.2 + pulseAmp * 1.5;
            }
        }

        // 2. Photon Scattering Random Fluctuations
        if (this.options.showPhotons && this.photonPoints) {
            const positions = this.photonPoints.geometry.attributes.position.array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] -= dt * 4.0;
                if (positions[i * 3 + 1] < 0.5) {
                    positions[i * 3 + 1] = 4.2;
                }
            }
            this.photonPoints.geometry.attributes.position.needsUpdate = true;
        }

        // 3. Electrical Signal Flow along the Circuit Path
        if (this.options.showSignalFlow && this.signalPackets) {
            // Signal pathway route points
            const waypoints = [
                new THREE.Vector3(-16, 2.5, 0),
                new THREE.Vector3(-10, 4.0, -3),
                new THREE.Vector3(3, 1.5, -4),   // TIA Amp
                new THREE.Vector3(11, 1.5, -4),  // ADC
                new THREE.Vector3(18, 1.5, 0),   // MCU
                new THREE.Vector3(6, 1.8, 4.5)   // OLED Display
            ];

            this.signalPackets.forEach(pkt => {
                pkt.userData.progress = (pkt.userData.progress + dt * 0.35) % 1.0;
                const totalSegments = waypoints.length - 1;
                const scaledProg = pkt.userData.progress * totalSegments;
                const segIdx = Math.floor(scaledProg);
                const segFrac = scaledProg - segIdx;

                if (segIdx < totalSegments) {
                    pkt.position.lerpVectors(waypoints[segIdx], waypoints[segIdx + 1], segFrac);
                }
            });
        }

        // 4. Update OLED Display Texture with Live Telemetry
        if (this.dsp) {
            this.updateOLEDTexture(this.dsp.smoothSpO2, this.dsp.smoothBPM, time * 0.5);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

if (typeof window !== 'undefined') {
    window.PulseOximetry3DLab = PulseOximetry3DLab;
}
