// ==========================================================================
// OMNI-HUMAN 3D — Wearable Spine Hardware Sensor & 50 Hz BLE Telemetry Engine
// Simulates 4-node high-frequency IMU spine sensor telemetry strip (Curv)
// Couples postural orientation, angular velocity, and live raw packet streams
// ==========================================================================

class TelemetryEngine {
    constructor(kinematicsEngine) {
        this.kinematicsEngine = kinematicsEngine;

        // DOM elements for nodes
        this.elCervical = document.getElementById('t-cervical');
        this.elThoracic = document.getElementById('t-thoracic');
        this.elLumbar = document.getElementById('t-lumbar');
        this.elSacral = document.getElementById('t-sacral');

        this.barCervical = document.getElementById('t-bar-cervical');
        this.barThoracic = document.getElementById('t-bar-thoracic');
        this.barLumbar = document.getElementById('t-bar-lumbar');
        this.barSacral = document.getElementById('t-bar-sacral');

        this.feedLines = document.getElementById('feed-lines');
        this.packetSequence = 1000;
        this.packetTimer = null;
    }

    init() {
        // Start 50 Hz BLE packet loop (20ms interval, throttled UI append to ~100ms for browser smoothness)
        this.packetTimer = setInterval(() => {
            this.generatePacket();
        }, 120);
    }

    update() {
        if (!this.kinematicsEngine) return;

        // Base angles driven by kinematics + micro-tremors
        const tremor = (Math.random() - 0.5) * 0.4;
        const lumbarBase = this.kinematicsEngine.lumbarAngle;
        const latBase = this.kinematicsEngine.latBendAngle;

        const pitchCervical = (lumbarBase * 0.35 + tremor * 1.2).toFixed(1);
        const pitchThoracic = (lumbarBase * 0.65 + tremor * 0.8).toFixed(1);
        const pitchLumbar = (lumbarBase * 1.0 + tremor * 0.6).toFixed(1);
        const pitchSacral = (lumbarBase * 0.15 + tremor * 0.3).toFixed(1);

        // Update labels
        if (this.elCervical) this.elCervical.textContent = `Pitch: ${pitchCervical}° | Roll: ${(latBase * 0.4).toFixed(1)}°`;
        if (this.elThoracic) this.elThoracic.textContent = `Pitch: ${pitchThoracic}° | Roll: ${(latBase * 0.7).toFixed(1)}°`;
        if (this.elLumbar) this.elLumbar.textContent = `Pitch: ${pitchLumbar}° | Roll: ${(latBase * 1.0).toFixed(1)}°`;
        if (this.elSacral) this.elSacral.textContent = `Pitch: ${pitchSacral}° | Roll: ${(latBase * 0.2).toFixed(1)}°`;

        // Update visual bars
        const calcPercent = (val, max) => Math.min(100, Math.max(5, (Math.abs(val) / max) * 100));
        if (this.barCervical) this.barCervical.style.width = `${calcPercent(pitchCervical, 45)}%`;
        if (this.barThoracic) this.barThoracic.style.width = `${calcPercent(pitchThoracic, 55)}%`;
        if (this.barLumbar) this.barLumbar.style.width = `${calcPercent(pitchLumbar, 60)}%`;
        if (this.barSacral) this.barSacral.style.width = `${calcPercent(pitchSacral, 25)}%`;
    }

    generatePacket() {
        if (!this.feedLines) return;

        this.packetSequence++;
        const nodes = ['C1-C7', 'T1-T12', 'L1-L5', 'SACRAL'];
        const selectedNode = nodes[this.packetSequence % nodes.length];
        const rssi = -55 - Math.floor(Math.random() * 18);
        const battery = 96;

        let angle = 0;
        if (this.kinematicsEngine) {
            angle = (this.kinematicsEngine.lumbarAngle + (Math.random() - 0.5) * 2).toFixed(1);
        }

        const packet = `[SEQ:${this.packetSequence}] NODE:${selectedNode} PIT:${angle}&deg; RSSI:${rssi}dBm BATT:${battery}%`;

        const div = document.createElement('div');
        div.className = 'packet-line';
        div.innerHTML = packet;

        this.feedLines.appendChild(div);

        // Keep maximum 8 lines in log
        while (this.feedLines.children.length > 8) {
            this.feedLines.removeChild(this.feedLines.firstChild);
        }
    }
}

window.TelemetryEngine = TelemetryEngine;
