const circuitCanvas = document.getElementById('circuitCanvas');
const circuitCtx = circuitCanvas.getContext('2d');
const componentList = document.getElementById('componentList');
const addBatteryBtn = document.getElementById('addBattery');
const addResistorBtn = document.getElementById('addResistor');
const addCapacitorBtn = document.getElementById('addCapacitor');
const playPauseBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const toggleSwitchBtn = document.getElementById('toggleSwitchBtn');

const readoutV = document.getElementById('readoutV');
const readoutR = document.getElementById('readoutR');
const readoutI = document.getElementById('readoutI');
const readoutVc = document.getElementById('readoutVc');
const readoutTau = document.getElementById('readoutTau');
const statusText = document.getElementById('statusText');

const canvasPairs = [
    { canvas: circuitCanvas, ctx: circuitCtx }
];

let components = [];
let componentId = 1;
let running = false;
let lastTime = 0;
let t = 0;
let animationFrameId;
let switchClosed = false;
let particles = [];
const particleCount = 28;

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

function addComponent(type) {
    if (type === 'battery' && components.some(item => item.type === 'battery')) {
        statusText.textContent = 'Only one battery is allowed.';
        return;
    }
    if (type === 'capacitor' && components.some(item => item.type === 'capacitor')) {
        statusText.textContent = 'Only one capacitor is supported for now.';
        return;
    }

    const defaults = {
        battery: { value: 9, unit: 'V' },
        resistor: { value: 100, unit: 'ohm' },
        capacitor: { value: 0.001, unit: 'F' }
    };

    const config = defaults[type];
    components.push({
        id: componentId++,
        type,
        value: config.value,
        unit: config.unit
    });

    statusText.textContent = 'Series circuit only.';
    renderComponents();
    resetSimulation();
}

function removeComponent(id) {
    components = components.filter(item => item.id !== id);
    renderComponents();
    resetSimulation();
}

function moveComponent(id, direction) {
    const index = components.findIndex(item => item.id === id);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= components.length) return;
    const temp = components[index];
    components[index] = components[targetIndex];
    components[targetIndex] = temp;
    renderComponents();
    resetSimulation();
}

function updateComponentValue(id, value) {
    const item = components.find(component => component.id === id);
    if (!item) return;
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;
    item.value = Math.max(0, nextValue);
    resetSimulation();
}

function renderComponents() {
    componentList.innerHTML = '';

    components.forEach((component, index) => {
        const row = document.createElement('div');
        row.className = 'component-item';

        const main = document.createElement('div');
        main.className = 'component-main';

        const title = document.createElement('div');
        title.className = 'component-title';
        title.textContent = `${component.type.charAt(0).toUpperCase() + component.type.slice(1)} ${index + 1}`;

        const inputWrap = document.createElement('div');
        inputWrap.className = 'component-input';

        const input = document.createElement('input');
        input.type = 'number';
        input.step = component.type === 'capacitor' ? '0.0001' : '1';
        input.value = component.value;
        input.min = '0';
        input.addEventListener('input', event => updateComponentValue(component.id, event.target.value));

        const unit = document.createElement('span');
        unit.textContent = component.unit;

        inputWrap.appendChild(input);
        inputWrap.appendChild(unit);

        main.appendChild(title);
        main.appendChild(inputWrap);

        const actions = document.createElement('div');
        actions.className = 'component-actions';

        const upBtn = document.createElement('button');
        upBtn.className = 'icon-btn';
        upBtn.textContent = 'Up';
        upBtn.addEventListener('click', () => moveComponent(component.id, -1));

        const downBtn = document.createElement('button');
        downBtn.className = 'icon-btn';
        downBtn.textContent = 'Down';
        downBtn.addEventListener('click', () => moveComponent(component.id, 1));

        const removeBtn = document.createElement('button');
        removeBtn.className = 'icon-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removeComponent(component.id));

        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(removeBtn);

        row.appendChild(main);
        row.appendChild(actions);
        componentList.appendChild(row);
    });

    updateAddButtons();
    draw();
}

function updateAddButtons() {
    const hasBattery = components.some(item => item.type === 'battery');
    const hasCapacitor = components.some(item => item.type === 'capacitor');
    addBatteryBtn.disabled = hasBattery;
    addCapacitorBtn.disabled = hasCapacitor;
}

function getCircuitData() {
    const battery = components.find(item => item.type === 'battery');
    const resistors = components.filter(item => item.type === 'resistor');
    const capacitor = components.find(item => item.type === 'capacitor');

    if (!battery) return { valid: false, message: 'Add a battery to run the circuit.' };
    if (resistors.length === 0) return { valid: false, message: 'Add at least one resistor.' };

    const totalR = resistors.reduce((sum, item) => sum + item.value, 0);
    if (totalR <= 0) return { valid: false, message: 'Total resistance must be greater than 0.' };

    const voltage = battery.value;
    const capValue = capacitor ? capacitor.value : null;

    return {
        valid: true,
        voltage,
        totalR,
        capacitor: capValue,
        hasCapacitor: Boolean(capacitor)
    };
}

function getCurrent(data, time) {
    if (!data.valid) return { current: 0, capVoltage: 0 };
    const baseCurrent = data.voltage / data.totalR;
    if (!data.hasCapacitor || !data.capacitor) {
        return { current: baseCurrent, capVoltage: 0 };
    }
    const tau = data.totalR * data.capacitor;
    if (tau <= 0) return { current: 0, capVoltage: 0 };
    return {
        current: baseCurrent * Math.exp(-time / tau),
        capVoltage: data.voltage * (1 - Math.exp(-time / tau))
    };
}

function updateReadouts(data, current, capVoltage) {
    readoutV.textContent = data.valid ? data.voltage.toFixed(2) : '-';
    readoutR.textContent = data.valid ? data.totalR.toFixed(2) : '-';
    readoutI.textContent = data.valid ? current.toFixed(3) : '-';
    readoutVc.textContent = data.hasCapacitor ? capVoltage.toFixed(2) : '-';

    if (data.hasCapacitor) {
        const tau = data.totalR * data.capacitor;
        readoutTau.textContent = tau > 0 ? tau.toFixed(3) : '-';
    } else {
        readoutTau.textContent = '-';
    }
}

function resetSimulation() {
    running = false;
    playPauseBtn.textContent = 'Play';
    t = 0;
    cancelAnimationFrame(animationFrameId);
    initParticles();
    draw();
}

function initParticles() {
    particles = Array.from({ length: particleCount }, (_, i) => i / particleCount);
}

function loop(timestamp) {
    if (!running) return;
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.05) dt = 0.05;
    lastTime = timestamp;
    t += dt;

    const data = getCircuitData();
    if (!data.valid) {
        running = false;
        playPauseBtn.textContent = 'Play';
        statusText.textContent = data.message;
        return;
    }

    if (!switchClosed) {
        running = false;
        playPauseBtn.textContent = 'Play';
        statusText.textContent = 'Close the circuit to start current flow.';
        return;
    }

    const { current, capVoltage } = getCurrent(data, t);
    advanceParticles(current, dt);
    updateReadouts(data, current, capVoltage);
    draw();

    animationFrameId = requestAnimationFrame(loop);
}

function draw() {
    drawCircuit();
}

function advanceParticles(current, dt) {
    if (!switchClosed || current <= 0) return;
    const speed = Math.min(0.6, 0.08 + current * 0.02);
    particles = particles.map(progress => (progress + speed * dt) % 1);
}

function drawCircuit() {
    const { width, height } = clearCanvas(circuitCtx, circuitCanvas);
    const data = getCircuitData();

    const left = 50;
    const right = width - 50;
    const top = height * 0.35;
    const bottom = height * 0.65;
    const midY = (top + bottom) / 2;

    drawLoopWire(circuitCtx, left, right, top, bottom, switchClosed);

    if (!data.valid) {
        circuitCtx.fillStyle = '#6b5f55';
        circuitCtx.font = '14px sans-serif';
        circuitCtx.fillText(data.message, left, top - 20);
        return;
    }

    const items = components.filter(item => item.type !== 'battery');
    const slots = Math.max(1, items.length + 1);
    const slotWidth = (right - left) / slots;
    let x = left + slotWidth * 0.5;

    drawBatterySymbol(circuitCtx, x, top, data.voltage);
    x += slotWidth;

    items.forEach(item => {
        if (item.type === 'resistor') {
            drawResistor(circuitCtx, x, top, item.value);
        } else if (item.type === 'capacitor') {
            drawCapacitor(circuitCtx, x, top, item.value);
        }
        x += slotWidth;
    });

    const { current, capVoltage } = getCurrent(data, t);
    updateReadouts(data, switchClosed ? current : 0, switchClosed ? capVoltage : 0);
    drawParticles(circuitCtx, left, right, top, bottom, switchClosed, current);
}

function drawLoopWire(ctx, left, right, top, bottom, closed) {
    ctx.strokeStyle = '#6b5f55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, bottom);

    if (closed) {
        ctx.lineTo(left, bottom);
        ctx.closePath();
    } else {
        const gap = 26;
        const gapStart = (left + right) / 2 - gap / 2;
        const gapEnd = gapStart + gap;
        ctx.lineTo(gapEnd, bottom);
        ctx.moveTo(gapStart, bottom);
        ctx.lineTo(left, bottom);
        ctx.lineTo(left, top);
    }

    ctx.stroke();

    if (!closed) {
        ctx.strokeStyle = '#c46b2e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo((left + right) / 2 - 8, bottom - 8);
        ctx.lineTo((left + right) / 2 + 8, bottom + 8);
        ctx.stroke();
    }
}

function drawParticles(ctx, left, right, top, bottom, closed, current) {
    if (!closed || current <= 0) return;
    const pathLength = 2 * ((right - left) + (bottom - top));
    const radius = 3;
    ctx.fillStyle = '#0f766e';

    particles.forEach(progress => {
        const distance = progress * pathLength;
        const { x, y } = getPointOnLoop(distance, left, right, top, bottom);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function getPointOnLoop(distance, left, right, top, bottom) {
    const width = right - left;
    const height = bottom - top;
    const perimeter = 2 * (width + height);
    let d = distance % perimeter;

    if (d <= width) return { x: left + d, y: top };
    d -= width;
    if (d <= height) return { x: right, y: top + d };
    d -= height;
    if (d <= width) return { x: right - d, y: bottom };
    d -= width;
    return { x: left, y: bottom - d };
}

function drawBatterySymbol(ctx, x, y, voltage) {
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 18);
    ctx.lineTo(x - 12, y + 18);
    ctx.moveTo(x + 12, y - 10);
    ctx.lineTo(x + 12, y + 10);
    ctx.stroke();

    ctx.fillStyle = '#0f766e';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${voltage.toFixed(1)} V`, x - 18, y - 24);
}

function drawResistor(ctx, x, y, value) {
    ctx.strokeStyle = '#c46b2e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(x - 20, y - 10, 40, 20);
    ctx.stroke();

    ctx.fillStyle = '#c46b2e';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${value.toFixed(0)} ohm`, x - 24, y - 18);
}

function drawCapacitor(ctx, x, y, value) {
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 18);
    ctx.lineTo(x - 10, y + 18);
    ctx.moveTo(x + 10, y - 18);
    ctx.lineTo(x + 10, y + 18);
    ctx.stroke();

    ctx.fillStyle = '#0ea5e9';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${value.toFixed(4)} F`, x - 24, y - 24);
}

addBatteryBtn.addEventListener('click', () => addComponent('battery'));
addResistorBtn.addEventListener('click', () => addComponent('resistor'));
addCapacitorBtn.addEventListener('click', () => addComponent('capacitor'));

playPauseBtn.addEventListener('click', () => {
    const data = getCircuitData();
    if (!data.valid) {
        statusText.textContent = data.message;
        return;
    }

    if (!switchClosed) {
        statusText.textContent = 'Close the circuit to start current flow.';
        return;
    }

    running = !running;
    playPauseBtn.textContent = running ? 'Pause' : 'Play';
    if (running) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(loop);
    }
});

resetBtn.addEventListener('click', resetSimulation);

toggleSwitchBtn.addEventListener('click', () => {
    switchClosed = !switchClosed;
    toggleSwitchBtn.textContent = switchClosed ? 'Open Circuit' : 'Close Circuit';
    statusText.textContent = switchClosed ? 'Circuit closed. Press Play to start.' : 'Circuit open.';
    resetSimulation();
});
window.addEventListener('resize', () => {
    resizeCanvases();
    draw();
});

resizeCanvases();
initParticles();
renderComponents();
