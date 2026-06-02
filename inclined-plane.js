// --- DOM Elements ---
const simCanvas = document.getElementById('simCanvas');
const simCtx = simCanvas.getContext('2d');
const fbdCanvas = document.getElementById('fbdCanvas');
const fbdCtx = fbdCanvas.getContext('2d');
const graphCanvas = document.getElementById('graphCanvas');
const graphCtx = graphCanvas.getContext('2d');

const canvasPairs = [
    { canvas: simCanvas, ctx: simCtx },
    { canvas: fbdCanvas, ctx: fbdCtx },
    { canvas: graphCanvas, ctx: graphCtx }
];

const inputs = {
    angle: document.getElementById('angle'),
    mass: document.getElementById('mass'),
    mus: document.getElementById('mus'),
    muk: document.getElementById('muk')
};

const displays = {
    angle: document.getElementById('angleVal'),
    mass: document.getElementById('massVal'),
    mus: document.getElementById('musVal'),
    muk: document.getElementById('mukVal'),
    t: document.getElementById('data-t'),
    x: document.getElementById('data-x'),
    v: document.getElementById('data-v'),
    a: document.getElementById('data-a'),
    fn: document.getElementById('data-fn'),
    ff: document.getElementById('data-ff')
};

const playBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const graphSelect = document.getElementById('graphSelect');

// --- Physics State ---
let state = {
    running: false,
    t: 0,
    x: 0,
    v: 0,
    a: 0,
    Fn: 0,
    Ff: 0,
    Fg: 0,
    theta: 30,
    m: 10,
    mus: 0.4,
    muk: 0.25,
    g: 9.8,
    rampLength: 10 // meters in simulation space
};

let lastTime = 0;
let historyData = []; // Stores {t, x, v, a}
let animationFrameId;

function resizeCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.floor(rect.width));
    const displayHeight = Math.max(1, Math.floor(rect.height));
    const nextWidth = Math.floor(displayWidth * dpr);
    const nextHeight = Math.floor(displayHeight * dpr);

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.dataset.cssWidth = displayWidth;
    canvas.dataset.cssHeight = displayHeight;
}

function resizeCanvases() {
    canvasPairs.forEach(({ canvas, ctx }) => resizeCanvas(canvas, ctx));
}

function getCanvasSize(canvas) {
    const width = Number(canvas.dataset.cssWidth) || canvas.width;
    const height = Number(canvas.dataset.cssHeight) || canvas.height;
    return { width, height };
}

function clearCanvas(ctx, canvas) {
    const { width, height } = getCanvasSize(canvas);
    ctx.clearRect(0, 0, width, height);
    return { width, height };
}

// --- Colors ---
const colors = {
    Fg: '#10b981', // Green
    Fn: '#3b82f6', // Blue
    Ff: '#ef4444'  // Red
};

// --- Initialization & Event Listeners ---
function init() {
    resizeCanvases();
    updateInputs();
}

function updateInputs() {
    state.theta = parseFloat(inputs.angle.value);
    state.m = parseFloat(inputs.mass.value);
    state.mus = parseFloat(inputs.mus.value);
    
    // Validation: muk cannot exceed mus
    let mukVal = parseFloat(inputs.muk.value);
    if (mukVal > state.mus) {
        inputs.muk.value = state.mus;
        mukVal = state.mus;
    }
    state.muk = mukVal;

    displays.angle.innerText = state.theta;
    displays.mass.innerText = state.m.toFixed(1);
    displays.mus.innerText = state.mus.toFixed(2);
    displays.muk.innerText = state.muk.toFixed(2);
    
    if(!state.running) draw();
}

Object.values(inputs).forEach(input => {
    input.addEventListener('input', updateInputs);
});

playBtn.addEventListener('click', () => {
    state.running = !state.running;
    playBtn.innerText = state.running ? "Pause" : "Play";
    if (state.running) {
        lastTime = performance.now();
        loop(lastTime);
    } else {
        cancelAnimationFrame(animationFrameId);
    }
});

resetBtn.addEventListener('click', () => {
    state.running = false;
    playBtn.innerText = "Play";
    cancelAnimationFrame(animationFrameId);
    state.t = 0;
    state.x = 0;
    state.v = 0;
    state.a = 0;
    historyData = [];
    draw();
    updateTable();
});

graphSelect.addEventListener('change', drawGraph);

window.addEventListener('resize', () => {
    resizeCanvases();
    draw();
});

// --- Main Loop & Physics Engine ---
function loop(currentTime) {
    if (!state.running) return;
    
    // dt in seconds (cap at 0.05 to prevent massive jumps on lag)
    let dt = (currentTime - lastTime) / 1000;
    if (dt > 0.05) dt = 0.05; 
    lastTime = currentTime;

    updatePhysics(dt);
    draw();
    updateTable();
    
    animationFrameId = requestAnimationFrame(loop);
}

function updatePhysics(dt) {
    if (state.x >= state.rampLength) {
        state.x = state.rampLength;
        state.v = 0;
        state.a = 0;
        return; // Reached bottom
    }

    const thetaRad = state.theta * Math.PI / 180;
    state.Fg = state.m * state.g;
    
    const Fg_parallel = state.Fg * Math.sin(thetaRad);
    const Fg_perp = state.Fg * Math.cos(thetaRad);
    
    state.Fn = Fg_perp;
    const Ff_max_static = state.mus * state.Fn;
    
    // Determine movement & friction
    if (Math.abs(state.v) < 0.01 && Fg_parallel <= Ff_max_static) {
        // Static
        state.a = 0;
        state.v = 0;
        state.Ff = Fg_parallel;
    } else {
        // Kinetic
        state.Ff = state.muk * state.Fn;
        const Fnet = Fg_parallel - state.Ff;
        state.a = Fnet / state.m;
    }

    state.v += state.a * dt;
    state.x += state.v * dt;
    state.t += dt;

    // Record for graph
    historyData.push({ t: state.t, x: state.x, v: state.v, a: state.a });
}

// --- Drawing Routines ---
function draw() {
    drawSimulation();
    drawFBD();
    drawGraph();
}

function drawArrow(ctx, fromX, fromY, toX, toY, color, label) {
    const headlen = 10;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "14px Arial";
    ctx.fillText(label, toX + 5, toY + 5);
}

function drawSimulation() {
    const { width, height } = clearCanvas(simCtx, simCanvas);
    const margin = 40;
    const thetaRad = state.theta * Math.PI / 180;

    const horizontalRoom = Math.max(1, width - margin * 2);
    const verticalRoom = Math.max(1, height - margin * 2);
    const pxLength = Math.min(
        420,
        horizontalRoom / Math.max(Math.cos(thetaRad), 0.001),
        verticalRoom / Math.max(Math.sin(thetaRad), 0.001)
    );

    const run = pxLength * Math.cos(thetaRad);
    const rise = pxLength * Math.sin(thetaRad);
    const topX = (width - run) / 2;
    const topY = (height - rise) / 2;
    const pivotX = topX + run;
    const pivotY = topY + rise;

    // Draw Ramp
    simCtx.fillStyle = '#e2e8f0';
    simCtx.beginPath();
    simCtx.moveTo(topX, topY);
    simCtx.lineTo(pivotX, pivotY);
    simCtx.lineTo(topX, pivotY);
    simCtx.fill();
    simCtx.strokeStyle = '#94a3b8';
    simCtx.stroke();

    const blockSize = Math.min(40, pxLength * 0.2);
    const blockW = blockSize;
    const blockH = blockSize;
    const startOffset = blockSize / 2;
    const usableLength = Math.max(1, pxLength - blockSize);

    // Map physical x to pixels with an offset so the block stays on the ramp
    let pxDist = (state.x / state.rampLength) * usableLength + startOffset;
    
    // Block center position
    const cx = topX + pxDist * Math.cos(thetaRad) + (blockH / 2) * Math.sin(thetaRad);
    const cy = topY + pxDist * Math.sin(thetaRad) - (blockH / 2) * Math.cos(thetaRad);

    // Draw Block
    simCtx.save();
    simCtx.translate(cx, cy);
    simCtx.rotate(thetaRad);
    simCtx.fillStyle = '#475569';
    simCtx.fillRect(-blockW/2, -blockH/2, blockW, blockH);
    simCtx.restore();

    // Draw Vectors on Block
    const scale = Math.max(0.45, Math.min(1.15, (Math.min(width, height) * 0.24) / Math.max(state.m * state.g, 1)));
    
    // Gravity (always down)
    const fg_px = state.m * state.g * scale;
    drawArrow(simCtx, cx, cy, cx, cy + fg_px, colors.Fg, "Fg");
    
    // Normal Force (perp to ramp, away from surface)
    const fn_px = state.m * state.g * Math.cos(thetaRad) * scale;
    drawArrow(simCtx, cx, cy, cx + fn_px * Math.sin(thetaRad), cy - fn_px * Math.cos(thetaRad), colors.Fn, "FN");
    
    // Friction (up ramp)
    let currentFf = state.running ? state.Ff : (state.m * state.g * Math.sin(thetaRad) <= state.mus * state.m * state.g * Math.cos(thetaRad) ? state.m * state.g * Math.sin(thetaRad) : state.muk * state.m * state.g * Math.cos(thetaRad));
    const ff_px = currentFf * scale;
    if (ff_px > 0) {
        drawArrow(simCtx, cx, cy, cx - ff_px * Math.cos(thetaRad), cy - ff_px * Math.sin(thetaRad), colors.Ff, "Ff");
    }
}

function drawFBD() {
    const { width, height } = clearCanvas(fbdCtx, fbdCanvas);
    const cx = width / 2;
    const cy = height / 2 + 20;
    
    // Central block (axis-aligned square)
    const blockSize = Math.min(32, Math.max(20, Math.min(width, height) * 0.14));
    const halfBlock = blockSize / 2;
    fbdCtx.fillStyle = '#334155';
    fbdCtx.fillRect(cx - halfBlock, cy - halfBlock, blockSize, blockSize);

    const scale = Math.max(0.45, Math.min(0.85, (Math.min(width, height) * 0.32) / Math.max(state.m * state.g, 1)));
    const thetaRad = state.theta * Math.PI / 180;

    // FBD in rotated axes: Normal up, friction left, gravity angled
    const fg_px = state.m * state.g * scale;
    const fn_px = state.m * state.g * Math.cos(thetaRad) * scale;
    
    let currentFf = state.running ? state.Ff : (state.m * state.g * Math.sin(thetaRad) <= state.mus * state.m * state.g * Math.cos(thetaRad) ? state.m * state.g * Math.sin(thetaRad) : state.muk * state.m * state.g * Math.cos(thetaRad));
    const ff_px = currentFf * scale;

    // Normal (up)
    drawArrow(fbdCtx, cx, cy, cx, cy - fn_px, colors.Fn, "FN");
    // Friction (left, up the ramp)
    if (ff_px > 0) drawArrow(fbdCtx, cx, cy, cx - ff_px, cy, colors.Ff, "Ff");
    // Gravity (angled relative to rotated axes)
    drawArrow(fbdCtx, cx, cy, cx + fg_px * Math.sin(thetaRad), cy + fg_px * Math.cos(thetaRad), colors.Fg, "Fg");
}

function drawGraph() {
    const { width, height } = clearCanvas(graphCtx, graphCanvas);
    if (historyData.length === 0) return;

    const mode = graphSelect.value;
    const modeMeta = {
        position: { key: 'x', label: 'Position', unit: 'm' },
        velocity: { key: 'v', label: 'Velocity', unit: 'm/s' },
        acceleration: { key: 'a', label: 'Acceleration', unit: 'm/s²' }
    };
    const selectedMode = modeMeta[mode] || modeMeta.position;
    const dataKey = selectedMode.key;
    const padding = {
        left: 72,
        right: 18,
        top: 28,
        bottom: 34
    };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const maxT = Math.max(5, state.t); // minimum 5s window

    const values = historyData.map(d => d[dataKey]);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    if (minVal === maxVal) {
        minVal -= 1;
        maxVal += 1;
    }

    const yLabel = `${selectedMode.label} (${selectedMode.unit})`;
    const xLabel = 'Time (s)';

    const zeroInsideRange = minVal < 0 && maxVal > 0;
    const valueToY = (value) => {
        if (zeroInsideRange) {
            return padding.top + (maxVal - value) / (maxVal - minVal) * plotHeight;
        }
        if (maxVal <= 0) {
            return padding.top + (value - minVal) / (maxVal - minVal) * plotHeight;
        }
        return padding.top + (maxVal - value) / (maxVal - minVal) * plotHeight;
    };

    graphCtx.fillStyle = '#334155';
    graphCtx.font = '12px sans-serif';
    graphCtx.textAlign = 'left';
    graphCtx.textBaseline = 'top';
    graphCtx.fillText(yLabel, padding.left, 6);
    graphCtx.textAlign = 'right';
    graphCtx.fillText(xLabel, width - padding.right, height - 20);

    const yTicks = 4;
    const xTicks = Math.min(6, Math.max(2, Math.floor(maxT)));
    const tickColor = '#dbe4ee';
    const labelColor = '#64748b';

    graphCtx.strokeStyle = tickColor;
    graphCtx.lineWidth = 1;

    for (let i = 0; i <= yTicks; i++) {
        const ratio = i / yTicks;
        const y = padding.top + ratio * plotHeight;
        graphCtx.beginPath();
        graphCtx.moveTo(padding.left, y);
        graphCtx.lineTo(width - padding.right, y);
        graphCtx.stroke();

        const tickValue = maxVal - ratio * (maxVal - minVal);
        graphCtx.fillStyle = labelColor;
        graphCtx.font = '11px monospace';
        graphCtx.textAlign = 'right';
        graphCtx.textBaseline = 'middle';
        graphCtx.fillText(`${tickValue.toFixed(2)} ${selectedMode.unit}`, padding.left - 8, y);
    }

    for (let i = 0; i <= xTicks; i++) {
        const ratio = i / xTicks;
        const x = padding.left + ratio * plotWidth;
        graphCtx.beginPath();
        graphCtx.moveTo(x, padding.top);
        graphCtx.lineTo(x, height - padding.bottom);
        graphCtx.stroke();

        const tickValue = ratio * maxT;
        graphCtx.fillStyle = labelColor;
        graphCtx.font = '11px monospace';
        graphCtx.textAlign = 'center';
        graphCtx.textBaseline = 'top';
        graphCtx.fillText(`${tickValue.toFixed(1)} s`, x, height - padding.bottom + 6);
    }

    graphCtx.strokeStyle = '#cbd5e1';
    graphCtx.lineWidth = 1;
    graphCtx.beginPath();
    graphCtx.moveTo(padding.left, padding.top);
    graphCtx.lineTo(padding.left, height - padding.bottom);
    graphCtx.lineTo(width - padding.right, height - padding.bottom);
    graphCtx.stroke();

    if (zeroInsideRange) {
        const zeroY = valueToY(0);
        graphCtx.beginPath();
        graphCtx.moveTo(padding.left, zeroY);
        graphCtx.lineTo(width - padding.right, zeroY);
        graphCtx.strokeStyle = '#94a3b8';
        graphCtx.stroke();
    }

    graphCtx.beginPath();
    graphCtx.strokeStyle = '#2563eb';
    graphCtx.lineWidth = 2;

    historyData.forEach((d, i) => {
        const px = padding.left + (d.t / maxT) * plotWidth;
        const py = valueToY(d[dataKey]);
        
        if (i === 0) graphCtx.moveTo(px, py);
        else graphCtx.lineTo(px, py);
    });
    
    graphCtx.stroke();
}

function updateTable() {
    displays.t.innerText = state.t.toFixed(2) + " s";
    displays.x.innerText = state.x.toFixed(2) + " m";
    displays.v.innerText = state.v.toFixed(2) + " m/s";
    displays.a.innerText = state.a.toFixed(2) + " m/s²";
    displays.fn.innerText = state.Fn.toFixed(2) + " N";
    
    let currentFf = state.running ? state.Ff : (state.m * state.g * Math.sin(state.theta * Math.PI/180) <= state.mus * state.Fn ? state.m * state.g * Math.sin(state.theta * Math.PI/180) : state.muk * state.Fn);
    displays.ff.innerText = currentFf.toFixed(2) + " N";
}

// Start
init();
