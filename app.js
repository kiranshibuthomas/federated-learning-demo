// ===== Main Application Logic =====

let currentMode = 'fl';

// ── Mode switching ──
function switchMode(mode) {
    currentMode = mode;
    document.getElementById('view-fl').classList.toggle('hidden', mode !== 'fl');
    document.getElementById('view-trad').classList.toggle('hidden', mode !== 'trad');
    document.getElementById('tab-fl').classList.toggle('active', mode === 'fl');
    document.getElementById('tab-trad').classList.toggle('active', mode === 'trad');
    document.getElementById('btnText').textContent = mode === 'fl' ? 'Start FL Training' : 'Start Traditional Training';
}
function handleStartTraining() {
    if (currentMode === 'fl') app.startFederatedTraining();
    else app.startTraditionalTraining();
}
function handleReset() { app.resetModels(); }
function sendMsg(profile) {
    const input = document.getElementById(`${profile}-input`);
    if (input.value.trim()) { app.addPhoneMessage(profile, input.value); input.value = ''; app.clearPredictions(profile); }
}
function sendTradMsg(profile) {
    const input = document.getElementById(`trad-${profile}-input`);
    if (!input.value.trim()) return;
    app.addTradMessage(profile, input.value);
    input.value = '';
    app.clearTradPredictions(profile);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ══════════════════════════════════════════
//  ANIMATION ENGINE
// ══════════════════════════════════════════

const SVG_NS = 'http://www.w3.org/2000/svg';

function getCenter(el) {
    const r = el.getBoundingClientRect();
    const stageId = currentMode === 'fl' ? 'view-fl' : 'view-trad';
    const sr = document.getElementById(stageId).getBoundingClientRect();
    return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 };
}

// Draw a curved SVG path between two elements, animate it drawing in, then fade out
function animateLine(fromEl, toEl, color, duration = 600) {
    const svg = document.getElementById('animSvg');
    const from = getCenter(fromEl);
    const to = getCenter(toEl);
    const mx = (from.x + to.x) / 2;
    const my = Math.min(from.y, to.y) - 40;
    const d = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-dasharray', '4 3');
    path.setAttribute('opacity', '0');
    svg.appendChild(path);

    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.style.transition = `stroke-dashoffset ${duration}ms ease, opacity 0.2s`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
        path.style.opacity = '0.5';
        path.style.strokeDashoffset = '0';
    }));

    setTimeout(() => {
        path.style.opacity = '0';
        setTimeout(() => path.remove(), 300);
    }, duration + 800);

    return path;
}

// Animate a labeled packet along a curved path
function animatePacketOnPath(fromEl, toEl, label, color, duration = 750, delay = 0) {
    return new Promise(resolve => {
        setTimeout(() => {
            const stageId = currentMode === 'fl' ? 'view-fl' : 'view-trad';
            const stage = document.getElementById(stageId);
            const from = getCenter(fromEl);
            const to = getCenter(toEl);

            // Create packet element
            const pkt = document.createElement('div');
            pkt.className = 'anim-packet';
            pkt.style.cssText = `
                position:absolute; z-index:200; pointer-events:none;
                left:${from.x}px; top:${from.y}px;
                transform: translate(-50%,-50%);
                opacity:0;
            `;
            pkt.innerHTML = `<div class="anim-packet-inner" style="background:${color}">${label}</div>`;
            stage.appendChild(pkt);

            // Animate along quadratic bezier
            const mx = (from.x + to.x) / 2;
            const my = Math.min(from.y, to.y) - 50;
            const start = performance.now();

            function frame(now) {
                const t = Math.min((now - start) / duration, 1);
                const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                // Quadratic bezier
                const x = (1 - ease) * (1 - ease) * from.x + 2 * (1 - ease) * ease * mx + ease * ease * to.x;
                const y = (1 - ease) * (1 - ease) * from.y + 2 * (1 - ease) * ease * my + ease * ease * to.y;
                pkt.style.left = x + 'px';
                pkt.style.top = y + 'px';
                pkt.style.opacity = t < 0.1 ? t * 10 : t > 0.85 ? (1 - t) / 0.15 : '1';
                if (t < 1) requestAnimationFrame(frame);
                else {
                    pkt.style.opacity = '0';
                    setTimeout(() => pkt.remove(), 150);
                    resolve();
                }
            }
            requestAnimationFrame(frame);
        }, delay);
    });
}

// Send multiple packets with stagger, return promise that resolves when all done
function sendPackets(fromEl, toEl, packets, duration = 750) {
    // packets: array of {label, color}
    return Promise.all(packets.map((p, i) =>
        animatePacketOnPath(fromEl, toEl, p.label, p.color, duration, i * 160)
    ));
}

// Pulse ring on server
function pulseServer(active) {
    const box = document.getElementById('serverBox');
    const status = document.getElementById('serverStatus');
    if (!box) return;
    box.classList.toggle('server-active', active);
    if (status) {
        status.textContent = active ? 'Aggregating...' : 'Idle';
        status.className = 'server-status' + (active ? ' active' : '');
    }
}

// Highlight phone frame
function highlightPhone(profile, on, color) {
    const frame = document.querySelector(`#phone-${profile} .phone-frame`);
    if (!frame) return;
    frame.style.boxShadow = on ? `0 0 0 2px ${color}, 0 8px 24px rgba(0,0,0,0.12)` : '';
    frame.style.transition = 'box-shadow 0.3s';
}

// ── Step indicator ──
function setStep(n) {
    [1,2,3,4].forEach(i => {
        const el = document.getElementById(`step${i}`);
        if (!el) return;
        el.classList.remove('active','done');
        if (i < n) el.classList.add('done');
        else if (i === n) el.classList.add('active');
    });
}

// ── Status bar ──
function setStatus(msg, state = 'training') {
    document.getElementById('statusText').textContent = msg;
    document.getElementById('statusDot').className = 'status-dot ' + state;
}

// ── Training overlay ──
const nnAnimators = {}; // profile -> { stop() }

function showOverlay(profile, label) {
    const ov = document.getElementById(`overlay-${profile}`);
    if (!ov) return;
    ov.classList.add('active');
    document.getElementById(`train-label-${profile}`).textContent = label;
    document.getElementById(`prog-${profile}`).style.width = '0%';
    const stats = document.getElementById(`train-stats-${profile}`);
    if (stats) stats.textContent = '';
    const epochEl = document.getElementById(`epoch-${profile}`);
    if (epochEl) epochEl.textContent = 'Epoch 0';

    // Clear canvases
    const nnCanvas = document.getElementById(`nn-${profile}`);
    const lossCanvas = document.getElementById(`loss-${profile}`);
    if (nnCanvas) { const ctx = nnCanvas.getContext('2d'); ctx.clearRect(0,0,nnCanvas.width,nnCanvas.height); }
    if (lossCanvas) { const ctx = lossCanvas.getContext('2d'); ctx.clearRect(0,0,lossCanvas.width,lossCanvas.height); }

    // Stop any existing animator
    if (nnAnimators[profile]) { nnAnimators[profile].stop(); delete nnAnimators[profile]; }

    // Start neural net animation
    const colors = { sports: '#e53e3e', baking: '#2b6cb0', cs: '#276749' };
    nnAnimators[profile] = startNNAnimation(profile, colors[profile]);
}

function hideOverlay(profile) {
    document.getElementById(`overlay-${profile}`)?.classList.remove('active');
    if (nnAnimators[profile]) { nnAnimators[profile].stop(); delete nnAnimators[profile]; }
}

function setProgress(profile, pct) {
    const bar = document.getElementById(`prog-${profile}`);
    if (bar) bar.style.width = pct + '%';
    // Update epoch display based on progress
    const epochEl = document.getElementById(`epoch-${profile}`);
    if (epochEl) epochEl.textContent = `Epoch ${Math.floor(pct / 10)}`;
    // Push a loss point
    if (nnAnimators[profile]) nnAnimators[profile].pushLoss(1 - pct / 100 * 0.7 + Math.random() * 0.05);
}

function setTrainStats(profile, acc, loss) {
    const el = document.getElementById(`train-stats-${profile}`);
    if (el) el.textContent = `${(acc*100).toFixed(1)}% · ${loss.toFixed(3)}`;
}

// ── Neural Network Canvas Animator ──
function startNNAnimation(profile, accentColor) {
    const nnCanvas = document.getElementById(`nn-${profile}`);
    const lossCanvas = document.getElementById(`loss-${profile}`);
    if (!nnCanvas || !lossCanvas) return { stop: ()=>{}, pushLoss: ()=>{} };

    const nc = nnCanvas.getContext('2d');
    const lc = lossCanvas.getContext('2d');
    const W = nnCanvas.width, H = nnCanvas.height;
    const LW = lossCanvas.width, LH = lossCanvas.height;

    // Network topology: 3 layers [3, 4, 3]
    const layers = [3, 4, 3];
    const nodeR = 6;
    const lossHistory = [];
    let running = true;
    let frame = 0;

    // Precompute node positions
    const nodes = layers.map((count, li) => {
        const x = 20 + li * ((W - 40) / (layers.length - 1));
        return Array.from({ length: count }, (_, ni) => ({
            x,
            y: (H / 2) - ((count - 1) / 2) * 22 + ni * 22,
            activation: Math.random()
        }));
    });

    function drawNN() {
        nc.clearRect(0, 0, W, H);

        // Draw connections
        for (let li = 0; li < layers.length - 1; li++) {
            for (const from of nodes[li]) {
                for (const to of nodes[li + 1]) {
                    const alpha = 0.08 + 0.12 * Math.abs(Math.sin(frame * 0.04 + from.y));
                    nc.strokeStyle = `rgba(100,100,100,${alpha})`;
                    nc.lineWidth = 0.8;
                    nc.beginPath();
                    nc.moveTo(from.x, from.y);
                    nc.lineTo(to.x, to.y);
                    nc.stroke();
                }
            }
        }

        // Animate activations propagating left to right
        const wave = (frame % 60) / 60;
        nodes.forEach((layer, li) => {
            layer.forEach((node, ni) => {
                const phase = li / (layers.length - 1);
                const pulse = Math.max(0, Math.sin((wave - phase) * Math.PI * 2));
                node.activation = 0.3 + 0.7 * pulse;

                // Node fill
                const a = node.activation;
                nc.beginPath();
                nc.arc(node.x, node.y, nodeR, 0, Math.PI * 2);
                nc.fillStyle = `rgba(${hexToRgb(accentColor)},${0.15 + 0.5 * a})`;
                nc.fill();
                nc.strokeStyle = accentColor;
                nc.lineWidth = 1.2;
                nc.globalAlpha = 0.4 + 0.6 * a;
                nc.stroke();
                nc.globalAlpha = 1;
            });
        });
    }

    function drawLoss() {
        lc.clearRect(0, 0, LW, LH);
        if (lossHistory.length < 2) return;

        const pad = 4;
        const minL = Math.min(...lossHistory);
        const maxL = Math.max(...lossHistory);
        const range = maxL - minL || 0.1;

        lc.strokeStyle = accentColor;
        lc.lineWidth = 1.5;
        lc.beginPath();
        lossHistory.forEach((v, i) => {
            const x = pad + (i / (lossHistory.length - 1)) * (LW - pad * 2);
            const y = LH - pad - ((v - minL) / range) * (LH - pad * 2);
            i === 0 ? lc.moveTo(x, y) : lc.lineTo(x, y);
        });
        lc.stroke();

        // Fill under curve
        lc.lineTo(pad + (lossHistory.length - 1) / (lossHistory.length - 1) * (LW - pad * 2), LH - pad);
        lc.lineTo(pad, LH - pad);
        lc.closePath();
        lc.fillStyle = `rgba(${hexToRgb(accentColor)},0.08)`;
        lc.fill();

        // "Loss" label
        lc.fillStyle = '#9ca3af';
        lc.font = '8px system-ui';
        lc.fillText('loss', pad + 1, pad + 8);
    }

    function tick() {
        if (!running) return;
        frame++;
        drawNN();
        drawLoss();
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    return {
        stop() { running = false; },
        pushLoss(val) { lossHistory.push(val); if (lossHistory.length > 40) lossHistory.shift(); }
    };
}

// Helper: hex color to "r,g,b" string
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
}

// ── Server merge animation ──
function flashServerMerge() {
    const box = document.getElementById('serverBox');
    if (!box) return;
    box.style.position = 'relative';
    const ring = document.createElement('div');
    ring.className = 'server-merge-ring';
    box.appendChild(ring);
    setTimeout(() => ring.remove(), 700);
}

// Animate a number counting up
function animateCount(el, from, to, duration = 600, suffix = '') {
    const start = performance.now();
    function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        const val = from + (to - from) * (t < 0.5 ? 2*t*t : -1+(4-2*t)*t);
        el.textContent = val.toFixed(suffix === '%' ? 1 : 0) + suffix;
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// ══════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════

class FederatedKeyboardApp {
    constructor() {
        this.server = new FederatedLearningServer();
        this.clients = {};
        this.isTraining = false;
        this.initialized = false;
        this.tradInitialized = false;
        this.tradModel = null;
        this.predictionTimeouts = {};
        this.tradPredictionTimeouts = {};
        this.setupInputHandlers();
        setStatus('Ready to train', 'idle');
    }

    async initializeClients() {
        if (this.initialized) return;
        setStatus('Initializing models...', 'training');
        for (const profile of ['sports', 'baking', 'cs']) {
            const client = new FederatedClient(profile, VOCABULARY[profile], TRAINING_DATA[profile]);
            await client.initialize();
            this.clients[profile] = client;
            this.server.registerClient(profile, client.getModel());
        }
        this.initialized = true;
        this.updateUI();
    }

    setupInputHandlers() {
        ['sports', 'baking', 'cs'].forEach(profile => {
            const input = document.getElementById(`${profile}-input`);
            if (input) {
                input.addEventListener('input', e => this.handleInput(profile, e.target.value));
                input.addEventListener('keyup', e => { if (e.key !== 'Enter') this.handleInput(profile, e.target.value); });
                input.addEventListener('keypress', e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                        this.addPhoneMessage(profile, e.target.value);
                        e.target.value = ''; this.clearPredictions(profile);
                    }
                });
            }
            const tradInput = document.getElementById(`trad-${profile}-input`);
            if (tradInput) {
                tradInput.addEventListener('input', e => this.handleTradInput(profile, e.target.value));
                tradInput.addEventListener('keyup', e => { if (e.key !== 'Enter') this.handleTradInput(profile, e.target.value); });
                tradInput.addEventListener('keypress', e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                        this.addTradMessage(profile, e.target.value);
                        e.target.value = ''; this.clearTradPredictions(profile);
                    }
                });
            }
        });
    }

    async handleInput(profile, text) {
        clearTimeout(this.predictionTimeouts[profile]);
        if (!this.initialized || this.isTraining) { this.clearPredictions(profile); return; }
        this.predictionTimeouts[profile] = setTimeout(async () => {
            try { this.displayPredictions(profile, await this.clients[profile].predict(text, 5)); }
            catch { this.clearPredictions(profile); }
        }, 100);
    }

    async handleTradInput(profile, text) {
        clearTimeout(this.tradPredictionTimeouts[profile]);
        if (!this.tradInitialized || this.isTraining) { this.clearTradPredictions(profile); return; }
        this.tradPredictionTimeouts[profile] = setTimeout(async () => {
            try { this.displayTradPredictions(profile, await this.tradModel.predict(text, 5)); }
            catch { this.clearTradPredictions(profile); }
        }, 100);
    }

    displayPredictions(profile, predictions) {
        const div = document.getElementById(`${profile}-predictions`);
        if (!div) return;
        div.innerHTML = '';
        (predictions || []).forEach(pred => {
            const chip = document.createElement('div');
            chip.className = 'prediction-chip' +
                (pred.confidence > 0.3 ? ' confidence-high' : pred.confidence > 0.15 ? ' confidence-medium' : ' confidence-low');
            chip.textContent = `${pred.word} (${(pred.confidence*100).toFixed(0)}%)`;
            chip.addEventListener('click', () => {
                const input = document.getElementById(`${profile}-input`);
                input.value += (input.value.endsWith(' ') ? '' : ' ') + pred.word + ' ';
                input.focus(); this.handleInput(profile, input.value);
            });
            div.appendChild(chip);
        });
    }

    displayTradPredictions(profile, predictions) {
        const div = document.getElementById(`trad-${profile}-predictions`);
        if (!div) return;
        div.innerHTML = '';
        (predictions || []).forEach(pred => {
            const chip = document.createElement('div');
            chip.className = 'prediction-chip' +
                (pred.confidence > 0.3 ? ' confidence-high' : pred.confidence > 0.15 ? ' confidence-medium' : ' confidence-low');
            chip.textContent = `${pred.word} (${(pred.confidence*100).toFixed(0)}%)`;
            chip.addEventListener('click', () => {
                const input = document.getElementById(`trad-${profile}-input`);
                input.value += (input.value.endsWith(' ') ? '' : ' ') + pred.word + ' ';
                input.focus(); this.handleTradInput(profile, input.value);
            });
            div.appendChild(chip);
        });
    }

    clearPredictions(profile) { const d = document.getElementById(`${profile}-predictions`); if (d) d.innerHTML = ''; }
    clearTradPredictions(profile) { const d = document.getElementById(`trad-${profile}-predictions`); if (d) d.innerHTML = ''; }

    addPhoneMessage(profile, text) {
        const chat = document.getElementById(`${profile}-messages`);
        if (!chat) return;
        const msg = document.createElement('div');
        msg.className = 'phone-msg'; msg.textContent = text;
        chat.appendChild(msg); chat.scrollTop = chat.scrollHeight;
    }
    addTradMessage(profile, text) {
        const chat = document.getElementById(`trad-${profile}-messages`);
        if (!chat) return;
        const msg = document.createElement('div');
        msg.className = 'tpm-msg'; msg.textContent = text;
        chat.appendChild(msg); chat.scrollTop = chat.scrollHeight;
    }

    // ══════════════════════════════════════════
    //  FEDERATED TRAINING
    // ══════════════════════════════════════════
    async startFederatedTraining() {
        if (this.isTraining) return;
        if (!this.initialized) await this.initializeClients();

        this.isTraining = true;
        const btn = document.getElementById('startTraining');
        btn.disabled = true;
        document.getElementById('btnText').textContent = 'Training...';

        const profiles = ['sports', 'baking', 'cs'];
        const colors = { sports: '#e53e3e', baking: '#2b6cb0', cs: '#276749' };
        const serverEl = document.getElementById('serverBox');
        const phoneEls = {
            sports: document.getElementById('phone-sports'),
            baking: document.getElementById('phone-baking'),
            cs: document.getElementById('phone-cs')
        };

        try {
            // ── STEP 1: Local Training ──
            setStep(1);
            setStatus('Step 1 — Local training on each device', 'training');

            // Highlight all phones
            profiles.forEach(p => highlightPhone(p, true, colors[p]));

            const trainPromises = profiles.map(async (profile) => {
                showOverlay(profile, 'Training locally...');
                let p = 0;
                const iv = setInterval(() => {
                    p = Math.min(p + Math.random() * 9, 95);
                    setProgress(profile, p);
                }, 70);
                const result = await this.clients[profile].localTraining(1);
                clearInterval(iv);
                setProgress(profile, 100);
                setTrainStats(profile, result.accuracy, result.loss);
                document.getElementById(`train-label-${profile}`).textContent = 'Done';
                this.updateClientStats(profile, result);
                return result;
            });

            await Promise.all(trainPromises);
            await sleep(500);
            profiles.forEach(p => { hideOverlay(p); highlightPhone(p, false); });

            // ── STEP 2: Upload weights ──
            setStep(2);
            setStatus('Step 2 — Uploading model weights to server', 'training');

            // Draw connection lines + send labeled packets simultaneously
            profiles.forEach(p => animateLine(phoneEls[p], serverEl, colors[p], 700));
            await sleep(100);

            await Promise.all(profiles.map(profile =>
                sendPackets(phoneEls[profile], serverEl, [
                    { label: 'W', color: colors[profile] },
                    { label: 'W', color: colors[profile] },
                    { label: 'W', color: colors[profile] }
                ], 700)
            ));

            await sleep(200);

            // ── STEP 3: FedAvg ──
            setStep(3);
            setStatus('Step 3 — Federated Averaging on server', 'training');
            pulseServer(true);
            document.getElementById('srv-round').textContent = this.server.trainingRounds + 1;

            await sleep(1400);
            const success = await this.server.performFederatedRound();
            if (!success) throw new Error('FedAvg failed');

            // Flash merge animation on server
            flashServerMerge();
            await sleep(200);
            flashServerMerge();
            await sleep(300);
            flashServerMerge();

            const stats = this.server.getStats();
            document.getElementById('srv-round').textContent = stats.trainingRounds;

            // Animate accuracy counter on server
            const srvAccEl = document.getElementById('srv-acc');
            animateCount(srvAccEl, 0, parseFloat(document.getElementById('globalAccuracy').textContent) || 72, 600, '%');

            await sleep(500);
            pulseServer(false);

            // ── STEP 4: Distribute global model ──
            setStep(4);
            setStatus('Step 4 — Distributing global model back to devices', 'training');

            profiles.forEach(p => animateLine(serverEl, phoneEls[p], '#6b7280', 700));
            await sleep(100);

            await Promise.all(profiles.map(profile =>
                sendPackets(serverEl, phoneEls[profile], [
                    { label: 'G', color: '#6b7280' },
                    { label: 'G', color: '#6b7280' }
                ], 700)
            ));

            // Fine-tune with global model
            profiles.forEach(p => highlightPhone(p, true, colors[p]));
            const ftPromises = profiles.map(async (profile) => {
                showOverlay(profile, 'Fine-tuning...');
                let p = 0;
                const iv = setInterval(() => {
                    p = Math.min(p + Math.random() * 13, 95);
                    setProgress(profile, p);
                }, 55);
                const result = await this.clients[profile].localTraining(1);
                clearInterval(iv);
                setProgress(profile, 100);
                setTrainStats(profile, result.accuracy, result.loss);
                document.getElementById(`train-label-${profile}`).textContent = 'Updated';
                this.updateClientStats(profile, result);
                return result;
            });

            await Promise.all(ftPromises);
            await sleep(700);
            profiles.forEach(p => { hideOverlay(p); highlightPhone(p, false); });

            // All steps done
            [1,2,3,4].forEach(i => {
                const el = document.getElementById(`step${i}`);
                if (el) { el.classList.remove('active'); el.classList.add('done'); }
            });
            setStatus('Training complete — try typing in the phones', 'done');
            this.updateUI();

        } catch (err) {
            console.error(err);
            setStatus('Training error. Check console.', 'idle');
            profiles.forEach(p => { hideOverlay(p); highlightPhone(p, false); });
            pulseServer(false);
        } finally {
            this.isTraining = false;
            btn.disabled = false;
            document.getElementById('btnText').textContent = 'Start FL Training';
        }
    }

    // ══════════════════════════════════════════
    //  TRADITIONAL TRAINING
    // ══════════════════════════════════════════
    async startTraditionalTraining() {
        if (this.isTraining) return;
        if (!this.initialized) await this.initializeClients();

        this.isTraining = true;
        this.tradInitialized = false;
        const btn = document.getElementById('startTraining');
        btn.disabled = true;
        document.getElementById('btnText').textContent = 'Training...';

        const profiles = ['sports', 'baking', 'cs'];
        const colors = { sports: '#e53e3e', baking: '#2b6cb0', cs: '#276749' };
        const tradServer = document.getElementById('tradServerBox');
        const tradServerStatus = document.getElementById('tradServerStatus');
        const phoneEls = {
            sports: document.getElementById('trad-phone-sports'),
            baking: document.getElementById('trad-phone-baking'),
            cs: document.getElementById('trad-phone-cs')
        };

        try {
            setStatus('Uploading raw data to central server...', 'training');

            profiles.forEach(p => {
                document.getElementById(`trad-overlay-${p}`)?.classList.add('active');
            });
            if (tradServerStatus) { tradServerStatus.textContent = 'Receiving data...'; tradServerStatus.className = 'server-status active'; }

            const vaultItems = document.getElementById('vaultItems');
            if (vaultItems) vaultItems.innerHTML = '';

            // Send raw data packets — use "D" label (data) in red to contrast with FL's "W" (weights)
            await Promise.all(profiles.map(async (profile) => {
                await sendPackets(phoneEls[profile], tradServer, [
                    { label: 'D', color: colors[profile] },
                    { label: 'D', color: colors[profile] },
                    { label: 'D', color: colors[profile] },
                    { label: 'D', color: colors[profile] }
                ], 700);
                if (vaultItems) {
                    const item = document.createElement('div');
                    item.className = 'vault-item';
                    item.textContent = profile === 'sports' ? 'Alex data' : profile === 'baking' ? 'Bailey data' : 'Chris data';
                    vaultItems.appendChild(item);
                }
            }));

            await sleep(300);
            profiles.forEach(p => document.getElementById(`trad-overlay-${p}`)?.classList.remove('active'));

            setStatus('Training centralized model on all data...', 'training');
            if (tradServerStatus) tradServerStatus.textContent = 'Training...';

            const allVocab = [...new Set([...VOCABULARY.sports, ...VOCABULARY.baking, ...VOCABULARY.cs])];
            const allData = [...TRAINING_DATA.sports, ...TRAINING_DATA.baking, ...TRAINING_DATA.cs];
            this.tradModel = new LanguageModel('centralized', allVocab);
            await this.tradModel.buildModel();

            const srvBar = document.getElementById('tradServerProgress');
            let sp = 0;
            const srvIv = setInterval(() => { sp = Math.min(sp + Math.random() * 10, 95); if (srvBar) srvBar.style.width = sp + '%'; }, 80);
            const result = await this.tradModel.train(allData, 1, 32);
            clearInterval(srvIv);
            if (srvBar) srvBar.style.width = '100%';

            profiles.forEach(profile => {
                const el = document.getElementById(`trad-${profile}-accuracy`);
                if (el) el.textContent = `${(result.accuracy * 100).toFixed(1)}%`;
            });

            await sleep(500);
            setStatus('Distributing trained model back to devices...', 'training');
            if (tradServerStatus) tradServerStatus.textContent = 'Distributing...';

            await Promise.all(profiles.map(profile =>
                sendPackets(tradServer, phoneEls[profile], [
                    { label: 'M', color: '#6b7280' },
                    { label: 'M', color: '#6b7280' }
                ], 700)
            ));

            await sleep(300);
            if (tradServerStatus) { tradServerStatus.textContent = 'Done'; tradServerStatus.className = 'server-status'; }
            this.tradInitialized = true;
            setStatus('Done — type in any phone. All users get the same generic suggestions.', 'done');
            this.updateUI();

        } catch (err) {
            console.error(err);
            setStatus('Training error.', 'idle');
        } finally {
            this.isTraining = false;
            btn.disabled = false;
            document.getElementById('btnText').textContent = 'Start Traditional Training';
        }
    }

    updateClientStats(profile, result) {
        const acc = document.getElementById(`${profile}-accuracy`);
        const loss = document.getElementById(`${profile}-loss`);
        if (acc) animateCount(acc, 0, result.accuracy * 100, 500, '%');
        if (loss) loss.textContent = result.loss.toFixed(4);
    }

    updateUI() {
        const stats = this.server.getStats();
        animateCount(document.getElementById('trainingRounds'), 0, stats.trainingRounds, 400);
        animateCount(document.getElementById('totalUpdates'), 0, stats.totalUpdates, 400);
        document.getElementById('srv-round').textContent = stats.trainingRounds;

        let totalAcc = 0, count = 0;
        Object.keys(this.clients).forEach(profile => {
            const s = this.clients[profile].getStats();
            if (s.accuracy > 0) { totalAcc += s.accuracy; count++; }
        });
        const avg = count > 0 ? totalAcc / count * 100 : 0;
        animateCount(document.getElementById('globalAccuracy'), 0, avg, 600, '%');
        document.getElementById('srv-acc').textContent = avg > 0 ? avg.toFixed(1) + '%' : '—';
    }

    async resetModels() {
        if (this.isTraining) return;
        setStatus('Resetting...', 'idle');
        this.clients = {}; this.server = new FederatedLearningServer();
        this.initialized = false; this.tradInitialized = false; this.tradModel = null;

        ['sports', 'baking', 'cs'].forEach(profile => {
            ['', 'trad-'].forEach(prefix => {
                const msgs = document.getElementById(`${prefix}${profile}-messages`);
                if (msgs) msgs.innerHTML = '';
                const inp = document.getElementById(`${prefix}${profile}-input`);
                if (inp) inp.value = '';
            });
            document.getElementById(`${profile}-accuracy`).textContent = '—';
            document.getElementById(`${profile}-loss`).textContent = '—';
            const ta = document.getElementById(`trad-${profile}-accuracy`);
            if (ta) ta.textContent = '—';
            this.clearPredictions(profile);
            this.clearTradPredictions(profile);
            hideOverlay(profile);
            highlightPhone(profile, false);
        });

        const vault = document.getElementById('vaultItems');
        if (vault) vault.innerHTML = '';
        const srvBar = document.getElementById('tradServerProgress');
        if (srvBar) srvBar.style.width = '0%';
        const tradStatus = document.getElementById('tradServerStatus');
        if (tradStatus) { tradStatus.textContent = 'Idle'; tradStatus.className = 'server-status'; }

        document.getElementById('globalAccuracy').textContent = '—';
        document.getElementById('trainingRounds').textContent = '0';
        document.getElementById('totalUpdates').textContent = '0';
        document.getElementById('srv-round').textContent = '0';
        document.getElementById('srv-acc').textContent = '—';

        [1,2,3,4].forEach(i => document.getElementById(`step${i}`)?.classList.remove('active','done'));
        pulseServer(false);

        // Clear SVG lines
        const svg = document.getElementById('animSvg');
        if (svg) svg.innerHTML = '';

        setStatus('Ready to train', 'idle');
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => { app = new FederatedKeyboardApp(); });
