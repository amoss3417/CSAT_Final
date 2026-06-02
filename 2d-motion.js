const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

// UI Controls Elements
const vInput = document.getElementById('velocity');
const angleInput = document.getElementById('angle');
const gInput = document.getElementById('gravity');
const massInput = document.getElementById('mass'); 
const launchBtn = document.getElementById('launchBtn');
const resetBtn = document.getElementById('resetBtn');

const vVal = document.getElementById('v-val');
const angleVal = document.getElementById('angle-val');
const gVal = document.getElementById('g-val');
const massVal = document.getElementById('mass-val'); 

// UI Metrics Elements
const maxHeightDisplay = document.getElementById('maxHeightVal');
const distanceDisplay = document.getElementById('distanceVal');

// Setup Layout Coordinates
const groundY = canvas.height - 50;
const startX = 50;
const startY = groundY - 10; 

let particle = {
    x: startX,
    y: startY,
    vx: 0,
    vy: 0,
    radius: 7, // Fixed radius that will never change
    color: '#38bdf8',
    active: false
};

let trail = [];
let gravity = 9.8;
let SCALE = 6.5; 
let dt = 0.016; 

let highestYPixel = startY; 

// UI Input Handlers
vInput.addEventListener('input', () => vVal.textContent = `${vInput.value} m/s`);
angleInput.addEventListener('input', () => angleVal.textContent = `${angleInput.value}°`);
gInput.addEventListener('input', () => gVal.textContent = `${gInput.value} m/s²`);
massInput.addEventListener('input', () => {
    massVal.textContent = `${massInput.value} kg`;
    // Only update text layout readout; radius size properties remain locked
});

// Launch Logic
launchBtn.addEventListener('click', () => {
    const v0 = parseFloat(vInput.value);
    const angleDeg = parseFloat(angleInput.value);
    const angleRad = (angleDeg * Math.PI) / 180;
    gravity = parseFloat(gInput.value);

    // Dynamic Scaling & Time Calculation
    if (gravity > 0) {
        const theoreticalMaxHeight = Math.pow(v0 * Math.sin(angleRad), 2) / (2 * gravity);
        const theoreticalDistance = (Math.pow(v0, 2) * Math.sin(2 * angleRad)) / gravity;
        const totalHangTime = (2 * v0 * Math.sin(angleRad)) / gravity;

        const maxAvailableWidth = canvas.width - startX - 50; 
        const maxAvailableHeight = startY - 30;              

        const scaleX = theoreticalDistance > 0 ? maxAvailableWidth / theoreticalDistance : Infinity;
        const scaleY = theoreticalMaxHeight > 0 ? maxAvailableHeight / theoreticalMaxHeight : Infinity;
        
        SCALE = Math.min(scaleX, scaleY);
        if (SCALE > 15) SCALE = 15; 
        if (SCALE < 0.5) SCALE = 0.5;

        const desiredAnimationDuration = 1.5; 
        if (totalHangTime > 0) {
            dt = totalHangTime / (desiredAnimationDuration * 60);
        } else {
            dt = 0.016; 
        }
    } else {
        SCALE = 4.0;
        dt = 0.016; 
    }

    // Reset Particle Position
    particle.x = startX;
    particle.y = startY;
    
    particle.vx = (v0 * Math.cos(angleRad)) * SCALE * dt;
    particle.vy = (-v0 * Math.sin(angleRad)) * SCALE * dt; 

    particle.active = true;
    trail = []; 
    highestYPixel = startY; 

    maxHeightDisplay.textContent = "Calculating...";
    distanceDisplay.textContent = "Calculating...";
});

// Reset Logic
resetBtn.addEventListener('click', () => {
    particle.active = false;
    particle.x = startX;
    particle.y = startY;
    particle.vx = 0;
    particle.vy = 0;
    trail = [];
    maxHeightDisplay.textContent = "0.00 m";
    distanceDisplay.textContent = "0.00 m";
});

function drawBackground() {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.fillRect(38, groundY, 24, 10);
}

function updatePhysics() {
    if (!particle.active) return;

    trail.push({x: particle.x, y: particle.y});

    if (particle.y < highestYPixel) {
        highestYPixel = particle.y;
    }

    particle.x += particle.vx;
    particle.vy += (gravity * SCALE * dt * dt); 
    particle.y += particle.vy;

    // Ground impact check
    if (particle.y >= groundY - particle.radius) {
        particle.y = groundY - particle.radius;
        particle.active = false; 
        calculateFinalMetrics();
    }

    // Boundary containment check
    if (particle.x > canvas.width || particle.x < 0 || particle.y < 0) {
        particle.active = false;
        calculateFinalMetrics();
    }
}

function calculateFinalMetrics() {
    const v0 = parseFloat(vInput.value);
    const angleRad = (parseFloat(angleInput.value) * Math.PI) / 180;
    const g = parseFloat(gInput.value);

    if (g === 0) {
        maxHeightDisplay.textContent = angleRad === 0 ? "0.00 m" : "Infinity";
        distanceDisplay.textContent = "Infinity";
        return;
    }

    const finalMaxHeight = Math.pow(v0 * Math.sin(angleRad), 2) / (2 * g);
    const finalDistance = (Math.pow(v0, 2) * Math.sin(2 * angleRad)) / g;

    maxHeightDisplay.textContent = `${finalMaxHeight.toFixed(2)} m`;
    distanceDisplay.textContent = `${finalDistance.toFixed(2)} m`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
        if (i === 0) ctx.moveTo(trail[i].x, trail[i].y);
        else ctx.lineTo(trail[i].x, trail[i].y);
    }
    ctx.stroke();

    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
}

function loop() {
    updatePhysics();
    draw();
    requestAnimationFrame(loop);
}

loop();
