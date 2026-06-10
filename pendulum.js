const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const graphCanvas = document.getElementById('graphCanvas');
const graphCtx = graphCanvas.getContext('2d');

// UI Controls Elements
const lengthInput = document.getElementById('length');
const massInput = document.getElementById('mass');
const angleInput = document.getElementById('angle');
const dragToggle = document.getElementById('dragToggle');
const graphTypeSelect = document.getElementById('graphType');
const launchBtn = document.getElementById('launchBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

const lengthVal = document.getElementById('length-val');
const massVal = document.getElementById('mass-val');
const angleVal = document.getElementById('angle-val');

// UI Metrics Elements
const currentAngleDisplay = document.getElementById('currentAngleVal');
const angVelDisplay = document.getElementById('angVelVal');

// Pivot Mount Position
const originX = canvas.width / 2;
const originY = 50;

// State Variables
let angle = (parseFloat(angleInput.value) * Math.PI) / 180; 
let angularVelocity = 0.0;
let angularAcceleration = 0.0;

let length = parseFloat(lengthInput.value);
let mass = parseFloat(massInput.value);
let isMoving = false;
let isPaused = false;

const gravity = 9.81; 
const dt = 0.016; 

// Graph Telemetry Array History
let graphData = [];
const maxGraphPoints = 400; 

// Helper function to lock/unlock inputs based on simulation state
function setInputsDisabled(disabledState) {
    lengthInput.disabled = disabledState;
    massInput.disabled = disabledState;
    angleInput.disabled = disabledState;
    dragToggle.disabled = disabledState;
}

// UI Listeners
lengthInput.addEventListener('input', () => {
    if (!isMoving) {
        length = parseFloat(lengthInput.value);
        lengthVal.textContent = `${(length / 100).toFixed(2)} m`;
        draw();
    }
});

massInput.addEventListener('input', () => {
    if (!isMoving) {
        mass = parseFloat(massInput.value);
        massVal.textContent = `${mass.toFixed(1)} kg`;
        draw();
    }
});

angleInput.addEventListener('input', () => {
    if (!isMoving) {
        angle = (parseFloat(angleInput.value) * Math.PI) / 180;
        draw();
    }
    angleVal.textContent = `${angleInput.value}°`;
});

// Dropdown change immediately redraws the static or active graph state with new values
graphTypeSelect.addEventListener('change', () => {
    drawGraph();
});

// Controls Handlers
launchBtn.addEventListener('click', () => {
    isMoving = true;
    isPaused = false;
    setInputsDisabled(true);
    launchBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    pauseBtn.textContent = 'Pause';
});

pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    setInputsDisabled(true);
});

resetBtn.addEventListener('click', () => {
    isMoving = false;
    isPaused = false;
    angularVelocity = 0.0;
    angularAcceleration = 0.0;
    angle = (parseFloat(angleInput.value) * Math.PI) / 180; 
    
    graphData = [];
    
    setInputsDisabled(false);
    launchBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
    
    currentAngleDisplay.textContent = `${angleInput.value}°`;
    angVelDisplay.textContent = "0.00 rad/s";
    draw();
    drawGraph();
});

function updatePhysics() {
    if (!isMoving || isPaused) return;

    const lengthMeters = length / 100;
    angularAcceleration = -(gravity / lengthMeters) * Math.sin(angle);

    if (dragToggle.checked) {
        const dragCoefficient = 0.12; 
        const dampingForce = -dragCoefficient * angularVelocity / mass;
        angularAcceleration += dampingForce;
    }

    angularVelocity += angularAcceleration * dt;
    angle += angularVelocity * dt;

    // Record data history types
    graphData.push({
        displacement: (angle * 180) / Math.PI, // Graph converted to degrees for clear reading
        velocity: angularVelocity,
        acceleration: angularAcceleration
    });

    if (graphData.length > maxGraphPoints) {
        graphData.shift();
    }

    const angleDegrees = (angle * 180) / Math.PI;
    currentAngleDisplay.textContent = `${angleDegrees.toFixed(1)}°`;
    angVelDisplay.textContent = `${angularVelocity.toFixed(2)} rad/s`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bobX = originX + length * Math.sin(angle);
    const bobY = originY + length * Math.cos(angle);

    ctx.fillStyle = '#64748b';
    ctx.fillRect(originX - 15, originY - 4, 30, 8);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    const bobRadius = 16; 
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(originX, originY, 4, 0, Math.PI * 2);
    ctx.fill();
}

function drawGraph() {
    graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

    const midY = graphCanvas.height / 2;
    const paddingLeft = 55; // Left margin padding space allocated for numerical text metrics
    const graphWidth = graphCanvas.width - paddingLeft;
    const currentSelection = graphTypeSelect.value;

    // 1. Configure configuration limits based on selection
    let ampScale, unitStr, maxValStr, minValStr;
    let lineStrokeColor = '#38bdf8';

    if (currentSelection === 'displacement') {
        ampScale = 0.8; 
        unitStr = "deg";
        maxValStr = "+90°";
        minValStr = "-90°";
        lineStrokeColor = '#38bdf8';
    } else if (currentSelection === 'velocity') {
        ampScale = 15;
        unitStr = "rad/s";
        maxValStr = "+4.0";
        minValStr = "-4.0";
        lineStrokeColor = '#10b981';
    } else if (currentSelection === 'acceleration') {
        ampScale = 4;
        unitStr = "rad/s²";
        maxValStr = "+15.0";
        minValStr = "-15.0";
        lineStrokeColor = '#f59e0b';
    }

    // 2. Draw numerical measurement guide text indicators on the left y-axis
    graphCtx.font = "10px monospace";
    graphCtx.fillStyle = "#94a3b8";
    graphCtx.textAlign = "right";
    graphCtx.textBaseline = "middle";

    // Upper limit label
    graphCtx.fillText(maxValStr, paddingLeft - 10, 20);
    // Center baseline zero label
    graphCtx.fillText("0.0", paddingLeft - 10, midY);
    // Lower limit label
    graphCtx.fillText(minValStr, paddingLeft - 10, graphCanvas.height - 20);

    // Draw unit type tag in top right area boundary
    graphCtx.textAlign = "right";
    graphCtx.fillText(`Unit: ${unitStr}`, graphCanvas.width - 15, 18);

    // 3. Draw vertical axis boundary lines
    graphCtx.strokeStyle = '#334155';
    graphCtx.lineWidth = 1.5;
    graphCtx.beginPath();
    graphCtx.moveTo(paddingLeft, 10);
    graphCtx.lineTo(paddingLeft, graphCanvas.height - 10);
    graphCtx.stroke();

    // 4. Draw center dashed reference baseline
    graphCtx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    graphCtx.lineWidth = 1;
    graphCtx.setLineDash([4, 4]);
    graphCtx.beginPath();
    graphCtx.moveTo(paddingLeft, midY);
    graphCtx.lineTo(graphCanvas.width, midY);
    graphCtx.stroke();
    graphCtx.setLineDash([]); 

    if (graphData.length === 0) return;

    // 5. Render active wave tracking graph path coordinates
    graphCtx.strokeStyle = lineStrokeColor;
    graphCtx.lineWidth = 2.5;
    graphCtx.beginPath();

    const horizontalSpacing = graphWidth / maxGraphPoints;

    for (let i = 0; i < graphData.length; i++) {
        const xPos = paddingLeft + (i * horizontalSpacing);
        const targetValue = graphData[i][currentSelection];
        const yPos = midY - (targetValue * ampScale);

        // Clamping checks to keep rendering neatly bound inside borders
        const clampedY = Math.max(10, Math.min(graphCanvas.height - 10, yPos));

        if (i === 0) {
            graphCtx.moveTo(xPos, clampedY);
        } else {
            graphCtx.lineTo(xPos, clampedY);
        }
    }
    graphCtx.stroke();
}

function loop() {
    updatePhysics();
    draw();
    drawGraph(); 
    requestAnimationFrame(loop);
}

// Initial draw sequence setup
drawGraph();
loop();
