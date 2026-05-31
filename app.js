
const els = {
  fsdeCanvas: document.getElementById("fsdeCanvas"),
  costateCanvas: document.getElementById("costateCanvas"),
  trainCanvas: document.getElementById("trainCanvas"),  lambdaConvCanvas: document.getElementById("lambdaConvCanvas"),
  hamiltonianCanvas: document.getElementById("hamiltonianCanvas"),
  piConvCanvas: document.getElementById("piConvCanvas"),
  playButton: document.getElementById("playButton"),
  resetButton: document.getElementById("resetButton"),
  piDot: document.getElementById("piDot"),
  piTargetMarker: document.getElementById("piTargetMarker"),
  piEstimateText: document.getElementById("piEstimateText"),
  piStartText: document.getElementById("piStartText"),
  piStarText: document.getElementById("piStarText"),
};

const model = {
  r: 0.03,
  alpha: 0.06,
  sigma: 0.20,
  gamma: 2.0,
  beta: 0.08,
  horizon: 1.0,
  steps: 60,
  paths: 18,
  x0: 1.0,
};

const stageCounts = [1,2,3,4,5,6,7,8,9,10,100,200,1000];
const visCounts =   [1,2,3,4,5,6,7,8,9,10,12,15,18];
const stageIntervals = stageCounts.map((_, i) => (i < 10 ? 0.5 : 0.14));

const state = {
  seed: 20260601,
  forwardPhase: 0,
  stageIndex: 0,
  stageTimer: 0,
  isPlaying: false,
  animationFrame: null,
  lastTs: 0,
};

const startGuess = { pi: 0.28 };
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function fmt(x, digits = 3) { return Number.isFinite(x) ? x.toFixed(digits) : "—"; }
function mulberry32(seed) { let t = seed >>> 0; return function rand() { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function normalPair(rand) {
  const u1 = Math.max(rand(), 1e-12), u2 = rand();
  const rr = Math.sqrt(-2 * Math.log(u1)), tt = 2 * Math.PI * u2;
  return [rr * Math.cos(tt), rr * Math.sin(tt)];
}

function makeData() {
  const rand = mulberry32(state.seed);
  const dt = model.horizon / model.steps, sqrtDt = Math.sqrt(dt);
  const paths = [], costates = [];
  for (let p = 0; p < model.paths; p += 1) {
    const piPath = 0.35 + 0.5 * rand();
    const cRatioPath = 0.03 + 0.05 * rand();
    let x = model.x0;
    const xx = [x];
    for (let k = 0; k < model.steps; k += 1) {
      const [z1, z2] = normalPair(rand); const z = k % 2 === 0 ? z1 : z2;
      const drift = model.r + piPath * model.alpha - cRatioPath - 0.5 * Math.pow(piPath * model.sigma, 2);
      const diff = piPath * model.sigma;
      x = x * Math.exp(drift * dt + diff * sqrtDt * z);
      xx.push(x);
    }
    const lambda = xx.map((val, i) => Math.exp(-model.beta * (model.horizon - i * dt)) * Math.pow(Math.max(val, 1e-6), -model.gamma));
    paths.push(xx); costates.push(lambda);
  }
  return { paths, costates };
}
const data = makeData();
const closedFormPi = model.alpha / (model.gamma * model.sigma * model.sigma);
const trueLambda0 = data.costates.reduce((acc, cur) => acc + cur[0], 0) / model.paths;
els.piStartText.textContent = `start ${fmt(startGuess.pi)}`;
els.piStarText.textContent = `critical point ${fmt(closedFormPi)}`;

const stageLambda0 = [0];
const stagePi = [startGuess.pi];
const lambdaStart = trueLambda0 * 1.34;
const lambdaFloor = trueLambda0 * 1.010;
const piFloor = closedFormPi - 0.004;
stageCounts.forEach((count, i) => {
  const decay = Math.exp(-1.60 * Math.log10(count));
  stageLambda0.push(lambdaFloor + (lambdaStart - lambdaFloor) * decay);
  const overshoot = i >= stageCounts.length - 2 ? 0 : 0.012 * Math.exp(-0.45 * (i + 1)) * Math.sin(0.85 * (i + 1));
  stagePi.push(piFloor + (startGuess.pi - piFloor) * Math.exp(-0.55 * (i + 1)) + overshoot);
});
stagePi[stagePi.length - 1] = piFloor;

function setupHiDPICanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.width, height = rect.height || canvas.height;
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}
function drawBackground(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "rgba(9,17,29,0.72)"); g.addColorStop(1, "rgba(8,15,24,0.94)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
}
function drawAxes(ctx, width, height, pad, xLabel, yLabel) {
  ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, height - pad.bottom); ctx.lineTo(width - pad.right, height - pad.bottom); ctx.stroke();
  ctx.fillStyle = "rgba(241,246,255,0.7)"; ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillText(yLabel, pad.left, Math.max(12, pad.top - 4)); ctx.textAlign = "right"; ctx.fillText(xLabel, width - pad.right, height - 10); ctx.restore();
}
function drawGrid(ctx, width, height, pad, rows = 5, cols = 6) {
  ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i <= rows; i += 1) { const y = pad.top + (i / rows) * (height - pad.top - pad.bottom); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); }
  for (let j = 0; j <= cols; j += 1) { const x = pad.left + (j / cols) * (width - pad.left - pad.right); ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke(); }
  ctx.restore();
}
function wealthGeometry(width, height) {
  const pad = { left: 38, right: 12, top: 14, bottom: 20 };
  const values = data.paths.flat(); const yMin = Math.min(...values) * 0.95, yMax = Math.max(...values) * 1.05;
  const xScale = (k) => pad.left + (k / model.steps) * (width - pad.left - pad.right);
  const yScale = (v) => height - pad.bottom - ((v - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
  return { pad, xScale, yScale };
}
function getStageContext() {
  const completed = state.stageIndex;
  const progress = state.stageIndex < stageCounts.length ? clamp(state.stageTimer / stageIntervals[state.stageIndex], 0, 1) : 1;
  const visDone = completed > 0 ? visCounts[completed - 1] : 0;
  const visTarget = completed < visCounts.length ? visCounts[completed] : visCounts[visCounts.length - 1];
  const countDisplay = completed > 0 ? stageCounts[completed - 1] : 0;
  return { completed, progress, visDone, visTarget, countDisplay };
}
function currentPiEstimate() {
  const { completed, progress } = getStageContext();
  if (completed === 0) return startGuess.pi;
  if (completed >= stageCounts.length) return closedFormPi;
  return stagePi[completed] + (stagePi[completed + 1] - stagePi[completed]) * progress;
}

function stage1Progress() {
  return clamp(state.forwardPhase, 0, 1);
}

function drawFigure1() {
  const { ctx, width, height } = setupHiDPICanvas(els.fsdeCanvas);
  const { pad, xScale, yScale } = wealthGeometry(width, height);
  drawBackground(ctx, width, height); drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "time", "wealth X");
  const revealStep = Math.max(1, Math.floor(state.forwardPhase * model.steps));
  for (let p = 0; p < model.paths; p += 1) {
    ctx.beginPath();
    for (let k = 0; k <= revealStep; k += 1) { const x = xScale(k), y = yScale(data.paths[p][k]); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = p < 4 ? "rgba(143,216,255,0.78)" : "rgba(148,240,193,0.28)"; ctx.lineWidth = p < 4 ? 2 : 1.2; ctx.stroke();
  }
  const cursorX = xScale(revealStep);
  ctx.save(); ctx.setLineDash([5, 6]); ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath(); ctx.moveTo(cursorX, pad.top); ctx.lineTo(cursorX, height - pad.bottom); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "rgba(241,246,255,0.82)"; ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.fillText("Sample paths are rolled out from (t₀, x₀) to T.", pad.left + 8, pad.top + 14);
  ctx.fillText("These forward trajectories drive the warm-up stage.", pad.left + 8, pad.top + 28);
  ctx.fillText("Later BPTT uses this rollout to recover costate information.", pad.left + 8, pad.top + 42);
  ctx.restore();
}

function drawTrainFigure() {
  const { ctx, width, height } = setupHiDPICanvas(els.trainCanvas);
  drawBackground(ctx, width, height);
  const prog = stage1Progress();
  // left: small neural network diagram
  const leftW = width * 0.42;
  const nodes = [3, 4, 3];
  const xs = [leftW * 0.18, leftW * 0.50, leftW * 0.82];
  const yCoords = nodes.map((n) => Array.from({length:n}, (_,i)=> height*0.2 + i*((height*0.6)/(Math.max(n-1,1)))));
  ctx.save();
  for (let l = 0; l < nodes.length - 1; l += 1) {
    for (const y1 of yCoords[l]) {
      for (const y2 of yCoords[l+1]) {
        ctx.beginPath();
        ctx.moveTo(xs[l], y1); ctx.lineTo(xs[l+1], y2);
        ctx.strokeStyle = `rgba(143,216,255,${0.10 + 0.22*prog})`;
        ctx.lineWidth = 1 + 0.5 * prog;
        ctx.stroke();
      }
    }
  }
  // glowing active connections during warm-up
  ctx.save();
  const timePulse = performance.now() * 0.0022;
  ctx.shadowBlur = 12 + 10 * prog;
  ctx.shadowColor = `rgba(148,240,193,${0.45 + 0.35*prog})`;
  const sparkEdges = [];
  for (let l = 0; l < nodes.length - 1; l += 1) {
    for (let j = 0; j < Math.min(yCoords[l].length, yCoords[l+1].length); j += 1) {
      const y1 = yCoords[l][j % yCoords[l].length];
      const y2 = yCoords[l+1][j % yCoords[l+1].length];
      sparkEdges.push([xs[l], y1, xs[l+1], y2]);
      ctx.beginPath();
      ctx.moveTo(xs[l], y1); ctx.lineTo(xs[l+1], y2);
      ctx.strokeStyle = `rgba(148,240,193,${0.30 + 0.60*prog})`;
      ctx.lineWidth = 1.8 + 1.4 * prog;
      ctx.stroke();
    }
  }
  // moving sparkles on selected weights; freeze when Stage 1 training is done
  const trainingDone = prog >= 0.999;
  sparkEdges.forEach((edge, idx) => {
    const [x1, y1, x2, y2] = edge;
    const pulse = trainingDone ? 0.88 : (timePulse + idx * 0.37) % 1;
    const px = x1 + (x2 - x1) * pulse;
    const py = y1 + (y2 - y1) * pulse;
    ctx.beginPath();
    ctx.fillStyle = trainingDone
      ? 'rgba(255,228,141,0.82)'
      : `rgba(255,228,141,${0.65 + 0.25 * Math.sin(timePulse * 6 + idx)})`;
    ctx.arc(px, py, trainingDone ? 2.4 : (2.0 + 1.2 * prog), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  for (let l = 0; l < nodes.length; l += 1) {
    for (const y of yCoords[l]) {
      ctx.beginPath();
      ctx.fillStyle = l===1 ? `rgba(255,176,122,${0.35 + 0.45*prog})` : `rgba(143,216,255,${0.35 + 0.45*prog})`;
      ctx.arc(xs[l], y, 7, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(241,246,255,0.82)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillText('policy network', 12, 15);
  // right: training loss curve
  const pad = { left: leftW + 28, right: 14, top: 22, bottom: 22 };
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i=0;i<=3;i++){ const y=pad.top+i*(height-pad.top-pad.bottom)/3; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(width-pad.right,y); ctx.stroke(); }
  for (let i=0;i<=4;i++){ const x=pad.left+i*(width-pad.left-pad.right)/4; ctx.beginPath(); ctx.moveTo(x,pad.top); ctx.lineTo(x,height-pad.bottom); ctx.stroke(); }
  const xScale = (u) => pad.left + u*(width-pad.left-pad.right);
  const yScale = (u) => height-pad.bottom - u*(height-pad.top-pad.bottom);
  ctx.beginPath();
  for (let i=0;i<=80;i++) {
    const u=i/80;
    const val = 0.82*Math.exp(-3.2*u) + 0.06 + 0.03*Math.sin(18*u)*Math.exp(-2.2*u);
    const x=xScale(u), y=yScale(val);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.strokeStyle='rgba(148,240,193,0.28)'; ctx.lineWidth=2.0; ctx.stroke();
  ctx.beginPath();
  for (let i=0;i<=Math.floor(80*prog);i++) {
    const u=i/80;
    const val = 0.82*Math.exp(-3.2*u) + 0.06 + 0.03*Math.sin(18*u)*Math.exp(-2.2*u);
    const x=xScale(u), y=yScale(val);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.strokeStyle='rgba(148,240,193,0.95)'; ctx.lineWidth=2.6; ctx.stroke();
  const u=prog; const val = 0.82*Math.exp(-3.2*u) + 0.06 + 0.03*Math.sin(18*u)*Math.exp(-2.2*u);
  ctx.beginPath(); ctx.fillStyle='rgba(148,240,193,1)'; ctx.arc(xScale(u), yScale(val), 4.4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(241,246,255,0.72)'; ctx.fillText('warm-up loss', pad.left, 15); ctx.restore();
}

function drawBPTTFigure() {
  const { ctx, width, height } = setupHiDPICanvas(els.bpttCanvas);
  drawBackground(ctx, width, height);
  const { completed, progress } = getStageContext();
  const bprog = state.forwardPhase < 1 ? 0 : clamp((completed + progress) / stageCounts.length, 0, 1);
  const left = 18, right = width - 18;
  const y = height - 18;
  const n = 6;
  const xs = Array.from({ length: n }, (_, i) => left + i * (right - left) / (n - 1));
  ctx.save();
  // forward chain faint
  for (let i = 0; i < n - 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(xs[i], y); ctx.lineTo(xs[i + 1], y);
    ctx.strokeStyle = 'rgba(143,216,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // nodes and labels
  for (let i = 0; i < n; i += 1) {
    ctx.beginPath();
    ctx.fillStyle = i === 0 ? 'rgba(148,240,193,0.95)' : 'rgba(143,216,255,0.75)';
    ctx.arc(xs[i], y, 5.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(241,246,255,0.60)'; ctx.font = '9px Inter, system-ui, sans-serif';
    const label = i === 0 ? 't₀' : (i === n - 1 ? 'T' : `t${i}`);
    ctx.fillText(label, xs[i] - 6, y + 14);
  }
  // backward arrows glowing from T to t0
  const arrowCount = n - 1;
  const active = bprog * arrowCount;
  for (let i = arrowCount - 1; i >= 0; i -= 1) {
    const local = clamp(active - (arrowCount - 1 - i), 0, 1);
    const x1 = xs[i + 1], x0 = xs[i], yy = y - 14 - (arrowCount - 1 - i) * 4.0;
    ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x0, yy);
    ctx.shadowBlur = 10 * local; ctx.shadowColor = `rgba(255,228,141,${0.65 * local})`;
    ctx.strokeStyle = `rgba(255,176,122,${0.26 + 0.68 * local})`; ctx.lineWidth = 2.0 + 1.2 * local; ctx.stroke(); ctx.shadowBlur = 0;
    if (local > 0.02) {
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + 6, yy - 3); ctx.lineTo(x0 + 6, yy + 3); ctx.closePath();
      ctx.fillStyle = `rgba(255,228,141,${0.28 + 0.68 * local})`; ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(241,246,255,0.84)'; ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText('BPTT on one sample path', 10, 12);
  ctx.fillStyle = 'rgba(241,246,255,0.68)';
  ctx.fillText('backward gradients create pathwise costates', 10, 22);
  // compact λpw marker at t0
  const boxY = 28;
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(12, boxY, width - 24, 18, 8); ctx.fill(); ctx.stroke(); }
  else { ctx.fillRect(12, boxY, width - 24, 18); ctx.strokeRect(12, boxY, width - 24, 18); }
  ctx.fillStyle = 'rgba(255,228,141,0.95)'; ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText('pathwise output: λ̂_pw(t₀)', 18, boxY + 12.5);
  ctx.restore();
}

function drawCostatePath(ctx, xScale, yScale, path, color, widthLine, alphaFull=1, glowTo=0) {
  // draw faint full path
  ctx.beginPath();
  for (let k = model.steps; k >= 0; k -= 1) { const x = xScale(k), y = yScale(path[k]); if (k === model.steps) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.strokeStyle = color.replace('ALPHA', alphaFull.toFixed(3)); ctx.lineWidth = widthLine; ctx.stroke();
  // draw sweeping glow from T backwards
  if (glowTo > 0) {
    const revealFrom = Math.round(model.steps * (1 - glowTo));
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(255,176,122,0.85)';
    ctx.beginPath();
    for (let k = model.steps; k >= revealFrom; k -= 1) { const x=xScale(k), y=yScale(path[k]); if (k===model.steps) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
    ctx.strokeStyle = 'rgba(255,228,141,0.95)'; ctx.lineWidth = widthLine + 1.7; ctx.stroke();
    ctx.restore();
  }
}

function drawFigure2() {
  const { ctx, width, height } = setupHiDPICanvas(els.costateCanvas);
  drawBackground(ctx, width, height);
  const pad = { left: 46, right: 18, top: 24, bottom: 34 };
  drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "time", "costate λ");
  const xScale = (k) => pad.left + (k / model.steps) * (width - pad.left - pad.right);
  const lambdaVals = data.costates.flat(); const lMin = Math.min(...lambdaVals) * 0.95, lMax = Math.max(...lambdaVals) * 1.05;
  const yScale = (v) => height - pad.bottom - ((v - lMin) / (lMax - lMin)) * (height - pad.top - pad.bottom);
  const { completed, progress, visDone, visTarget, countDisplay } = getStageContext();

  // completed paths
  for (let p = 0; p < visDone; p += 1) {
    drawCostatePath(ctx, xScale, yScale, data.costates[p], 'rgba(255,176,122,ALPHA)', p < 4 ? 1.8 : 1.0, p < 4 ? 0.80 : 0.18, 0);
  }
  // current stage paths glow in from the back
  if (state.forwardPhase >= 1 && completed < visCounts.length) {
    const newCount = visTarget - visDone;
    for (let j = 0; j < newCount; j += 1) {
      const p = visDone + j;
      if (p >= data.costates.length) break;
      const local = clamp(progress * newCount - j, 0, 1);
      if (local > 0) drawCostatePath(ctx, xScale, yScale, data.costates[p], 'rgba(255,176,122,ALPHA)', p < 4 ? 1.8 : 1.0, p < 4 ? 0.65 : 0.14, local);
    }
  }

  ctx.fillStyle = "rgba(241,246,255,0.84)"; ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.fillText("Backpropagation Through Time starts after forward simulation.", pad.left + 8, pad.top + 14);
  ctx.fillText("BPTT produces pathwise costate estimates along each rollout.", pad.left + 8, pad.top + 28);
  ctx.fillText("Averaging those pathwise estimates gives λ̂(t₀).", pad.left + 8, pad.top + 42);
  ctx.fillStyle = "rgba(255,228,141,0.92)";
  ctx.fillText(`BPTT samples: ${countDisplay}`, pad.left + 8, pad.top + 58);
}

function drawLambdaConvergence() {
  const { ctx, width, height } = setupHiDPICanvas(els.lambdaConvCanvas);
  drawBackground(ctx, width, height);
  const pad = { left: 38, right: 12, top: 22, bottom: 16 };
  drawGrid(ctx, width, height, pad, 4, 6); drawAxes(ctx, width, height, pad, "number of paths", "λ̂(t₀)");
  const xMax = stageCounts[stageCounts.length - 1];
  const xScale = (n) => pad.left + (Math.log10(Math.max(n,1)) / Math.log10(xMax)) * (width - pad.left - pad.right);
  const vals = stageLambda0.slice(1).concat([trueLambda0]);
  const yMin = Math.min(...vals) * 0.97, yMax = Math.max(...vals) * 1.03;
  const yScale = (v) => height - pad.bottom - ((v - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
  ctx.save(); ctx.setLineDash([5,5]); ctx.strokeStyle = "rgba(255,228,141,0.68)";
  ctx.beginPath(); ctx.moveTo(xScale(1), yScale(trueLambda0)); ctx.lineTo(xScale(xMax), yScale(trueLambda0)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,228,141,0.9)"; ctx.font = "12px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText("true λ(t₀)", pad.left + 8, yScale(trueLambda0) - 8); ctx.restore();
  const { completed, progress } = getStageContext();
  if (completed > 0) {
    ctx.beginPath();
    for (let n = 1; n <= completed; n += 1) { const x=xScale(stageCounts[n-1]), y=yScale(stageLambda0[n]); if(n===1) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
    if (completed < stageCounts.length) {
      const x0 = xScale(stageCounts[completed - 1]), y0 = yScale(stageLambda0[completed]);
      const x1 = xScale(stageCounts[completed]), y1 = yScale(stageLambda0[completed + 1]);
      ctx.lineTo(x0 + (x1 - x0) * progress, y0 + (y1 - y0) * progress);
    }
    ctx.strokeStyle = "rgba(143,216,255,0.95)"; ctx.lineWidth = 2.4; ctx.stroke();
  }
}

function drawFigure3() {
  const { ctx, width, height } = setupHiDPICanvas(els.hamiltonianCanvas);
  drawBackground(ctx, width, height);
  const pad = { left: 46, right: 18, top: 24, bottom: 34 };
  drawGrid(ctx, width, height, pad); drawAxes(ctx, width, height, pad, "risky weight π", "Hamiltonian");
  const piMax = 1.2; const h = (pi) => model.alpha * pi - 0.5 * model.gamma * model.sigma * model.sigma * pi * pi;
  const vals = []; for (let i = 0; i <= 180; i += 1) { const pi = (i/180)*piMax; vals.push({pi,h:h(pi)}); }
  const hMin = Math.min(...vals.map(d=>d.h)), hMax = Math.max(...vals.map(d=>d.h));
  const xScale = (pi) => pad.left + (pi/piMax) * (width - pad.left - pad.right);
  const yScale = (val) => height - pad.bottom - ((val - hMin) / (hMax - hMin)) * (height - pad.top - pad.bottom);
  ctx.beginPath(); vals.forEach((d,i)=>{ const x=xScale(d.pi), y=yScale(d.h); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
  ctx.strokeStyle = "rgba(143,216,255,0.92)"; ctx.lineWidth = 2.4; ctx.stroke();
  const criticalX = xScale(closedFormPi), criticalY = yScale(h(closedFormPi));
  ctx.save(); ctx.setLineDash([6,6]); ctx.strokeStyle = "rgba(255,255,255,0.24)"; ctx.beginPath(); ctx.moveTo(criticalX, pad.top); ctx.lineTo(criticalX, height-pad.bottom); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.fillStyle = "rgba(255,228,141,1)"; ctx.arc(criticalX, criticalY, 5.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "rgba(241,246,255,0.9)"; ctx.font = "12px Inter, system-ui, sans-serif"; ctx.fillText("critical point", criticalX - 86, criticalY - 12); ctx.restore();
  const piEst = currentPiEstimate(); const mx = xScale(piEst), my = yScale(h(piEst));
  ctx.beginPath(); ctx.fillStyle = "rgba(255,176,122,0.98)"; ctx.arc(mx,my,6.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = "rgba(241,246,255,0.86)"; ctx.font = "12px Inter, system-ui, sans-serif";
  const near = Math.abs(mx - criticalX) < 62;
  ctx.fillText("moving maximizer", near ? mx - 116 : mx + 8, near ? my + 24 : my - 10);
  updatePiTrack(piEst);
}

function drawPiConvergence() {
  const { ctx, width, height } = setupHiDPICanvas(els.piConvCanvas);
  drawBackground(ctx, width, height);
  const pad = { left: 46, right: 18, top: 20, bottom: 28 };
  drawGrid(ctx, width, height, pad, 4, 6); drawAxes(ctx, width, height, pad, "number of paths", "π̂");
  const xMax = stageCounts[stageCounts.length - 1];
  const xScale = (n) => pad.left + (Math.log10(Math.max(n,1)) / Math.log10(xMax)) * (width - pad.left - pad.right);
  const piVals = stagePi.slice(1).concat([closedFormPi, startGuess.pi]);
  const yMin = Math.min(...piVals) * 0.95, yMax = Math.max(...piVals) * 1.05;
  const yScale = (v) => height - pad.bottom - ((v - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
  ctx.save(); ctx.setLineDash([5,5]); ctx.strokeStyle = "rgba(255,228,141,0.68)";
  ctx.beginPath(); ctx.moveTo(xScale(1), yScale(closedFormPi)); ctx.lineTo(xScale(xMax), yScale(closedFormPi)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,228,141,0.9)"; ctx.font = "12px Inter, system-ui, sans-serif"; ctx.fillText("π*", xScale(xMax)-4, yScale(closedFormPi)-8); ctx.restore();
  const { completed, progress } = getStageContext();
  if (completed > 0) {
    ctx.beginPath();
    for (let n=1; n<=completed; n+=1) { const x=xScale(stageCounts[n-1]), y=yScale(stagePi[n]); if(n===1) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
    if (completed < stageCounts.length) {
      const x0 = xScale(stageCounts[completed - 1]), y0 = yScale(stagePi[completed]);
      const x1 = xScale(stageCounts[completed]), y1 = yScale(stagePi[completed + 1]);
      ctx.lineTo(x0 + (x1 - x0) * progress, y0 + (y1 - y0) * progress);
    }
    ctx.strokeStyle = "rgba(143,216,255,0.95)"; ctx.lineWidth = 2.4; ctx.stroke();
  }
}

function updatePiTrack(piEst) {
  const piRangeMax = 1.2;
  els.piDot.style.left = `${100 * clamp(piEst / piRangeMax, 0, 1)}%`;
  els.piTargetMarker.style.left = `${100 * clamp(closedFormPi / piRangeMax, 0, 1)}%`;
  els.piEstimateText.textContent = `π̂ = ${fmt(piEst)}`;
}
function drawAll() { drawFigure1(); drawTrainFigure(); drawFigure2(); drawLambdaConvergence(); drawFigure3(); drawPiConvergence(); }
function animate(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = (ts - state.lastTs) / 1000; state.lastTs = ts;
  if (state.isPlaying) {
    if (state.forwardPhase < 1) {
      state.forwardPhase = clamp(state.forwardPhase + dt / 2.0, 0, 1);
    } else if (state.stageIndex < stageCounts.length) {
      state.stageTimer += dt;
      const interval = stageIntervals[state.stageIndex];
      if (state.stageTimer >= interval) { state.stageTimer = 0; state.stageIndex += 1; }
    } else {
      state.isPlaying = false;
    }
  }
  drawAll(); state.animationFrame = requestAnimationFrame(animate);
}
function restartPipeline() { state.forwardPhase = 0; state.stageIndex = 0; state.stageTimer = 0; state.isPlaying = true; }
function resetPipeline() { state.forwardPhase = 0; state.stageIndex = 0; state.stageTimer = 0; state.isPlaying = false; drawAll(); }
els.playButton.addEventListener("click", restartPipeline);
els.resetButton.addEventListener("click", resetPipeline);
window.addEventListener("resize", drawAll);
updatePiTrack(startGuess.pi); drawAll(); state.animationFrame = requestAnimationFrame(animate); setTimeout(() => restartPipeline(), 350);
