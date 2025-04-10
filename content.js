let stoneModel = null;
let lastStepCount = 0;
let overlayCanvas = null;
let overlayVisible = true;  // Initially, the overlay is visible
let lastCanvasRect = null;  // Store the last position/size of the canvas

function findStoneModel(obj, visited = new Set()) {
  if (!obj || typeof obj !== 'object' || visited.has(obj)) return null;
  visited.add(obj);

  if (Array.isArray(obj.step_history)) return obj;

  for (const key in obj) {
    try {
      const result = findStoneModel(obj[key], visited);
      if (result) return result;
    } catch (e) {}
  }
  return null;
}

function guessSpacingFromSteps(history) {
  if (!Array.isArray(history) || history.length < 2) return 40;

  for (let i = 0; i < history.length - 1; i++) {
    const a = history[i];
    const b = history[i + 1];

    if (
      typeof a.px === 'number' && typeof b.px === 'number' &&
      typeof a.py === 'number' && typeof b.py === 'number' &&
      typeof a.x === 'number' && typeof b.x === 'number' &&
      typeof a.y === 'number' && typeof b.y === 'number'
    ) {
      const dGrid = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      const dPixels = Math.abs(b.px - a.px) + Math.abs(b.py - a.py);

      if (dGrid !== 0) return dPixels / dGrid;
    }
  }

  return 40; // fallback spacing
}

function coordToXY(coord) {
  if (!coord || coord.length !== 2) return null;
  const x = coord[0].charCodeAt(0) - 'a'.charCodeAt(0);
  const y = coord[1].charCodeAt(0) - 'a'.charCodeAt(0);
  return { x, y };
}

function drawAllDots(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !stoneModel || !Array.isArray(stoneModel.step_history)) return;
  if (stoneModel.step_history.length < 2) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const spacing = guessSpacingFromSteps(stoneModel.step_history);
  // Stones are not centered properly? Spacing needs to be slightly bigger
  const radius = spacing * 0.51;
  // Testing offset
  const offsetX = 0;
  const offsetY = 0;

  const drawnPoints = [];

  // Find the origin step for coordinate transformation
  const originStep = stoneModel.step_history.find(
    s => typeof s.px === 'number' && typeof s.py === 'number' && typeof s.x === 'number' && typeof s.y === 'number'
  );
  if (!originStep) return;

  const originX = originStep.x;
  const originY = originStep.y;
  const originPx = originStep.px;
  const originPy = originStep.py;

  const currentPositions = new Map();

  const steps = stoneModel.step_history.slice(0, -1); // skip last step
  for (const step of steps) {
    if (
      typeof step.x === 'number' && typeof step.y === 'number' &&
      typeof step.px === 'number' && typeof step.py === 'number'
    ) {
      const key = `${step.x},${step.y}`;
      currentPositions.set(key, { px: step.px, py: step.py });
    }
  }

  for (const { px, py } of currentPositions.values()) {
    drawnPoints.push({ px, py });
  }

  if (Array.isArray(stoneModel.prepos)) {
    for (const group of stoneModel.prepos) {
      for (const coord of group) {
        const point = coordToXY(coord);
        if (!point) continue;

        const key = `${point.x},${point.y}`;
        if (currentPositions.has(key)) continue;

        const rotatedX = originX - (point.y - originY);
        const rotatedY = originY + (point.x - originX);

        const px = originPx + (rotatedX - originX) * spacing;
        const py = originPy + (rotatedY - originY) * spacing;

        drawnPoints.push({ px, py });
      }
    }
  }

  for (const step of drawnPoints) {
    if (!step?.px || !step?.py) continue;
    const cx = step.px + offsetX;
    const cy = step.py + offsetY;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#e4b45c';
    ctx.fill();

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';

    ctx.beginPath();
    ctx.moveTo(cx + 0.5, cy - radius);
    ctx.lineTo(cx + 0.5, cy + radius);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - radius, cy + 0.5);
    ctx.lineTo(cx + radius, cy + 0.5);
    ctx.stroke();
  }

  const lastStep = stoneModel.step_history[stoneModel.step_history.length - 1];
  if (lastStep?.px && lastStep?.py) {
    const cx = lastStep.px + offsetX;
    const cy = lastStep.py + offsetY;

    const moveNum = stoneModel.step_history.length;
    const isBlack = (stoneModel.is_start_black && moveNum % 2 === 1) ||
                    (!stoneModel.is_start_black && moveNum % 2 === 0);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = isBlack ? '#000' : '#fff';
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.stroke();

    ctx.fillStyle = isBlack ? '#fff' : '#000';
    ctx.font = `${Math.floor(radius)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(moveNum, cx, cy);
  }
}


function createOrUpdateOverlay() {
  const board = document.querySelector('canvas');
  if (!board || !stoneModel) return;

  const rect = board.getBoundingClientRect();
  
  // Only update the position if the canvas position has changed
  if (!lastCanvasRect || lastCanvasRect.left !== rect.left || lastCanvasRect.top !== rect.top || lastCanvasRect.width !== rect.width || lastCanvasRect.height !== rect.height) {
    // If the position/size of the canvas has changed, update overlay position
    if (!overlayCanvas) {
      overlayCanvas = document.createElement('canvas');
      overlayCanvas.id = 'stone-mask-overlay';
      overlayCanvas.style.position = 'absolute';
      overlayCanvas.style.pointerEvents = 'none';
      overlayCanvas.style.zIndex = '9999';
      document.body.appendChild(overlayCanvas);
    }

    overlayCanvas.style.left = `${rect.left + window.scrollX}px`;
    overlayCanvas.style.top = `${rect.top + window.scrollY}px`;
    overlayCanvas.width = board.width;
    overlayCanvas.height = board.height;

    lastCanvasRect = rect; // Cache the current canvas position and size
  }

  drawAllDots(overlayCanvas);
}

function initWatcher() {
  const interval = setInterval(() => {
    if (!stoneModel) {
      stoneModel = findStoneModel(window);
      if (!stoneModel) return;
    }

    if (stoneModel.step_history.length > lastStepCount) {
      lastStepCount = stoneModel.step_history.length;
      if (overlayVisible) {
        createOrUpdateOverlay();  // Only create or update the overlay if it's visible
      }
    }
  }, 500);
}

// Toggle overlay on/off with spacebar
document.addEventListener('keydown', (e) => {
  if (e.key === 't') {
    overlayVisible = !overlayVisible;  // Toggle visibility
    if (overlayCanvas) {
      overlayCanvas.style.display = overlayVisible ? 'block' : 'none';  // Show or hide the overlay
    }
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'r') {
    stoneModel = null;
    lastStepCount = 0;
    lastCanvasRect = null;

    if (overlayCanvas) {
      overlayCanvas.remove();
      overlayCanvas = null;
    }

    initWatcher();
  }
});

// Recalculate overlay position on window resize
window.addEventListener('resize', () => {
  lastCanvasRect = null;  // Force recalculation of position on resize
});

window.addEventListener('load', () => {
  setTimeout(initWatcher, 1000);
});
