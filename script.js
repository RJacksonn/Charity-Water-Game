// Pipe types and their connection logic
const PIPE_TYPES = [
  'straight', // connects two opposite sides
  'elbow',    // connects two adjacent sides
  't',        // connects three sides
  'cross'     // connects all four sides
];

// Each pipe type has a connection map for 0, 90, 180, 270 degrees
const PIPE_CONNECTIONS = {
  straight: [
    [1, 0, 1, 0], // 0deg: up, right, down, left
    [0, 1, 0, 1], // 90deg
    [1, 0, 1, 0], // 180deg
    [0, 1, 0, 1], // 270deg
  ],
  elbow: [
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 1, 1],
    [1, 0, 0, 1],
  ],
  t: [
    [1, 1, 1, 0],
    [0, 1, 1, 1],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
  ],
  cross: [
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
  ]
};

const GRID_SIZE = 3;
let grid = [];
let rotationCount = 0;
let timer = 0;
let timerInterval = null;
let bestScore = null; // {time, rotations}
let gameActive = false;

function randomPipeType() {
  return PIPE_TYPES[Math.floor(Math.random() * PIPE_TYPES.length)];
}

function createPipeGrid() {
  // Step 1: Generate a random valid path from (0,0) to (GRID_SIZE-1, GRID_SIZE-1)
  grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  let path = [[0, 0]];
  let r = 0, c = 0;
  while (r !== GRID_SIZE - 1 || c !== GRID_SIZE - 1) {
    const moves = [];
    if (r < GRID_SIZE - 1) moves.push([r + 1, c]);
    if (c < GRID_SIZE - 1) moves.push([r, c + 1]);
    // Randomly pick next move
    const [nr, nc] = moves[Math.floor(Math.random() * moves.length)];
    path.push([nr, nc]);
    r = nr; c = nc;
  }
  // Step 2: Place correct pipe types and rotations along the path
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    let prev = i > 0 ? path[i - 1] : null;
    let next = i < path.length - 1 ? path[i + 1] : null;
    let dirs = [false, false, false, false]; // up, right, down, left
    if (prev) {
      if (prev[0] < r) dirs[0] = true; // came from up
      if (prev[0] > r) dirs[2] = true; // came from down
      if (prev[1] < c) dirs[3] = true; // came from left
      if (prev[1] > c) dirs[1] = true; // came from right
    }
    if (next) {
      if (next[0] < r) dirs[0] = true;
      if (next[0] > r) dirs[2] = true;
      if (next[1] < c) dirs[3] = true;
      if (next[1] > c) dirs[1] = true;
    }
    // Determine pipe type and rotation
    let type, rotation;
    const dirCount = dirs.filter(Boolean).length;
    if (dirCount === 2) {
      // straight or elbow
      if ((dirs[0] && dirs[2]) || (dirs[1] && dirs[3])) {
        type = 'straight';
        rotation = dirs[0] ? 0 : 1;
      } else {
        type = 'elbow';
        if (dirs[0] && dirs[1]) rotation = 0;
        else if (dirs[1] && dirs[2]) rotation = 1;
        else if (dirs[2] && dirs[3]) rotation = 2;
        else rotation = 3;
      }
    } else if (dirCount === 3) {
      type = 't';
      if (!dirs[3]) rotation = 0;
      else if (!dirs[0]) rotation = 1;
      else if (!dirs[1]) rotation = 2;
      else rotation = 3;
    } else if (dirCount === 4) {
      type = 'cross';
      rotation = 0;
    } else {
      // start or end
      type = 'straight';
      if (dirs[1]) rotation = 1; // right
      else if (dirs[2]) rotation = 0; // down
      else if (dirs[3]) rotation = 1; // left
      else rotation = 0; // up
    }
    grid[r][c] = { type, rotation, isPath: true };
  }
  // Step 3: Shuffle only the rotations of the path pipes (not their types)
  for (let i = 1; i < path.length - 1; i++) { // don't shuffle start/end
    const [r, c] = path[i];
    let maxRot = grid[r][c].type === 'straight' ? 2 : 4;
    grid[r][c].rotation = Math.floor(Math.random() * maxRot);
  }
  // Step 4: Fill the rest of the grid with random pipes/rotations
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (!grid[row][col]) {
        let type = randomPipeType();
        let rotation = Math.floor(Math.random() * 4);
        grid[row][col] = { type, rotation, isPath: false };
      }
    }
  }
}

function getPipeClass(type) {
  if (type === 'straight') return 'pipe straight';
  if (type === 'elbow') return 'pipe elbow';
  if (type === 't') return 'pipe t-junction';
  if (type === 'cross') return 'pipe cross';
  return 'pipe';
}

function getPipeSVG(type, rotation) {
  const size = 100;
  const stroke = 32; // Increased thickness
  let svg = '';
  // Metallic gradient
  const gradient = `<defs><linearGradient id='metal' x1='0%' y1='0%' x2='100%' y2='100%'>
    <stop offset='0%' stop-color='#e0e0e0'/>
    <stop offset='40%' stop-color='#b0b0b0'/>
    <stop offset='60%' stop-color='#d0d0d0'/>
    <stop offset='100%' stop-color='#888'/>
  </linearGradient></defs>`;
  if (type === 'straight') {
    svg = `
      <rect x='34' y='0' width='32' height='100' rx='16' fill='url(#metal)'/>
      <rect x='34' y='0' width='32' height='100' rx='16' fill='none' stroke='#888' stroke-width='2'/>
    `;
  } else if (type === 'elbow') {
    svg = `
      <rect x='34' y='0' width='32' height='66' rx='16' fill='url(#metal)'/>
      <rect x='34' y='0' width='32' height='66' rx='16' fill='none' stroke='#888' stroke-width='2'/>
      <rect x='34' y='34' width='66' height='32' rx='16' fill='url(#metal)'/>
      <rect x='34' y='34' width='66' height='32' rx='16' fill='none' stroke='#888' stroke-width='2'/>
    `;
  } else if (type === 't') {
    svg = `
      <rect x='34' y='0' width='32' height='100' rx='16' fill='url(#metal)'/>
      <rect x='34' y='0' width='32' height='100' rx='16' fill='none' stroke='#888' stroke-width='2'/>
      <rect x='0' y='34' width='100' height='32' rx='16' fill='url(#metal)'/>
      <rect x='0' y='34' width='100' height='32' rx='16' fill='none' stroke='#888' stroke-width='2'/>
    `;
  } else if (type === 'cross') {
    svg = `
      <rect x='34' y='0' width='32' height='100' rx='16' fill='url(#metal)'/>
      <rect x='34' y='0' width='32' height='100' rx='16' fill='none' stroke='#888' stroke-width='2'/>
      <rect x='0' y='34' width='100' height='32' rx='16' fill='url(#metal)'/>
      <rect x='0' y='34' width='100' height='32' rx='16' fill='none' stroke='#888' stroke-width='2'/>
    `;
  }
  return `<svg width='100' height='100' viewBox='0 0 100 100' style='transform:rotate(${rotation * 90}deg);'>${gradient}${svg}</svg>`;
}

function renderGrid() {
  const gridDiv = document.querySelector('.game-grid');
  gridDiv.innerHTML = '';
  gridDiv.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.innerHTML = getPipeSVG(grid[row][col].type, grid[row][col].rotation);
      // Add label for debugging
      const label = document.createElement('span');
      let t = grid[row][col].type;
      if (t === 'straight') t = 'S';
      if (t === 'elbow') t = 'E';
      if (t === 't') t = 'T';
      if (t === 'cross') t = 'C';
      label.textContent = `${t}${grid[row][col].rotation}`;
      label.style.position = 'absolute';
      label.style.bottom = '6px';
      label.style.right = '8px';
      label.style.background = 'rgba(255,255,255,0.7)';
      label.style.fontWeight = 'bold';
      label.style.fontSize = '1.1em';
      label.style.padding = '2px 6px';
      label.style.borderRadius = '6px';
      label.style.pointerEvents = 'none';
      cell.appendChild(label);
      cell.addEventListener('click', () => rotatePipe(row, col));
      gridDiv.appendChild(cell);
    }
  }
}

function rotatePipe(row, col) {
  // Don't allow rotating start/goal pipes
  if ((row === 0 && col === 0) || (row === GRID_SIZE - 1 && col === GRID_SIZE - 1)) return;
  grid[row][col].rotation = (grid[row][col].rotation + 1) % 4;
  rotationCount++;
  document.getElementById('rotation-count').textContent = rotationCount;
  renderGrid();
  checkWin();
}

function startGame() {
  rotationCount = 0;
  timer = 0;
  document.getElementById('rotation-count').textContent = rotationCount;
  document.getElementById('timer').textContent = timer;
  document.getElementById('result-message').textContent = '';
  createPipeGrid();
  renderGrid();
  gameActive = true;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timer++;
    document.getElementById('timer').textContent = timer;
  }, 1000);
}

function getConnections(type, rotation) {
  // Returns [up, right, down, left] (1=open, 0=closed)
  // 0deg: up, right, down, left
  if (type === 'straight') {
    return rotation % 2 === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1];
  }
  if (type === 'elbow') {
    if (rotation === 0) return [1, 1, 0, 0];
    if (rotation === 1) return [0, 1, 1, 0];
    if (rotation === 2) return [0, 0, 1, 1];
    if (rotation === 3) return [1, 0, 0, 1];
  }
  if (type === 't') {
    if (rotation === 0) return [1, 1, 1, 0];
    if (rotation === 1) return [0, 1, 1, 1];
    if (rotation === 2) return [1, 0, 1, 1];
    if (rotation === 3) return [1, 1, 0, 1];
  }
  if (type === 'cross') {
    return [1, 1, 1, 1];
  }
  return [0, 0, 0, 0];
}

function checkWin() {
  // BFS from (0,0) to (GRID_SIZE-1, GRID_SIZE-1), track path
  const visited = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
  const parent = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  const queue = [[0, 0]];
  visited[0][0] = true;
  let found = false;
  while (queue.length) {
    const [r, c] = queue.shift();
    if (r === GRID_SIZE - 1 && c === GRID_SIZE - 1) {
      found = true;
      break;
    }
    const conns = getConnections(grid[r][c].type, grid[r][c].rotation);
    const dr = [-1, 0, 1, 0];
    const dc = [0, 1, 0, -1];
    for (let d = 0; d < 4; d++) {
      if (!conns[d]) continue;
      const nr = r + dr[d];
      const nc = c + dc[d];
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
      if (visited[nr][nc]) continue;
      const neighborConns = getConnections(grid[nr][nc].type, grid[nr][nc].rotation);
      if (neighborConns[(d + 2) % 4]) {
        visited[nr][nc] = true;
        parent[nr][nc] = [r, c];
        queue.push([nr, nc]);
      }
    }
  }
  // Remove previous highlights
  document.querySelectorAll('.grid-cell').forEach(cell => cell.classList.remove('water-flow'));
  if (found) {
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById('result-message').textContent = `You win! Time: ${timer}s, Rotations: ${rotationCount}`;
    // Highlight path
    let path = [];
    let cur = [GRID_SIZE - 1, GRID_SIZE - 1];
    while (cur) {
      path.push(cur);
      cur = parent[cur[0]][cur[1]];
    }
    path.forEach(([r, c]) => {
      const idx = r * GRID_SIZE + c;
      document.querySelectorAll('.grid-cell')[idx].classList.add('water-flow');
    });
    // Update best score
    if (!bestScore || timer < bestScore.time || (timer === bestScore.time && rotationCount < bestScore.rotations)) {
      bestScore = { time: timer, rotations: rotationCount };
      updateBestScore();
    }
    gameActive = false;
    return true;
  }
  document.getElementById('result-message').textContent = '';
  return false;
}

function updateBestScore() {
  if (bestScore) {
    document.getElementById('best-score').textContent = `Time: ${bestScore.time}s, Rot: ${bestScore.rotations}`;
  } else {
    document.getElementById('best-score').textContent = '--';
  }
}

// Call updateBestScore on load
updateBestScore();

document.getElementById('start-game').addEventListener('click', startGame);
document.getElementById('new-game').addEventListener('click', () => {
  rotationCount = 0;
  timer = 0;
  document.getElementById('rotation-count').textContent = rotationCount;
  document.getElementById('timer').textContent = timer;
  document.getElementById('result-message').textContent = '';
  if (timerInterval) clearInterval(timerInterval);
  createPipeGrid();
  renderGrid();
  gameActive = true;
  timerInterval = setInterval(() => {
    timer++;
    document.getElementById('timer').textContent = timer;
  }, 1000);
  updateBestScore();
});
