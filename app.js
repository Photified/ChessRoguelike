// --- STATE ---
let gameState = {
  level: 1,
  board: { width: 5, height: 5 },
  pieces: [],
  selectedPieceId: null,
  validMoves: [],
  turn: 'player',
  perks: [],
  isDrafting: false
};

const symbols = { Knight: '♞', Pawn: '♟', Queen: '♛' };

// --- FLOW CONTROL ---
function initGame() {
  gameState.level = 1;
  gameState.board = { width: 5, height: 5 };
  gameState.perks = [];
  triggerDraft(); // FUN START: Get overpowered immediately
}

function triggerDraft() {
  gameState.isDrafting = true;
  document.getElementById('draft-title').textContent = `Level ${gameState.level} Draft! Pick a Perk:`;
  document.getElementById('draft-screen').style.display = 'flex';
}

window.selectGambit = function(perk) {
  if (!gameState.perks.includes(perk)) gameState.perks.push(perk);
  document.getElementById('draft-screen').style.display = 'none';
  gameState.isDrafting = false;
  startLevel();
};

function startLevel() {
  gameState.turn = 'player';
  gameState.selectedPieceId = null;
  gameState.validMoves = [];
  
  if (gameState.level === 3) gameState.board = { width: 6, height: 6 };
  if (gameState.level === 5) gameState.board = { width: 7, height: 7 };

  const px = Math.floor(gameState.board.width / 2);
  const py = gameState.board.height - 1;
  gameState.pieces = [{ id: 'player', type: 'Knight', team: 'player', x: px, y: py }];

  // Enemy Spawning Logic
  const pawnCount = gameState.level + 2; 
  for (let i = 0; i < pawnCount; i++) {
    spawnEnemy('Pawn', Math.floor(gameState.board.height / 2));
  }

  // Level 2+ introduces relentless Queens
  if (gameState.level >= 2) {
    spawnEnemy('Queen', 2);
  }

  log("Your turn! Annihilate them.");
  render();
}

function spawnEnemy(type, maxY) {
  let ex, ey, occupied;
  do {
    ex = Math.floor(Math.random() * gameState.board.width);
    ey = Math.floor(Math.random() * maxY);
    occupied = gameState.pieces.some(p => p.x === ex && p.y === ey);
  } while (occupied);
  gameState.pieces.push({ id: Math.random().toString(36).substr(2, 9), type: type, team: 'enemy', x: ex, y: ey });
}

// --- PLAYER LOGIC ---
function getValidMoves(piece) {
  const moves = [];
  if (piece.type === 'Knight') {
    // Standard L-Jumps
    let jumps = [
      {dx: 1, dy: 2}, {dx: 2, dy: 1}, {dx: 2, dy: -1}, {dx: 1, dy: -2},
      {dx: -1, dy: -2}, {dx: -2, dy: -1}, {dx: -2, dy: 1}, {dx: -1, dy: 2}
    ];
    // PERK: Agile Steed (Adds King movement!)
    if (gameState.perks.includes('agile')) {
      jumps = jumps.concat([
        {dx: 0, dy: 1}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: -1, dy: 0},
        {dx: 1, dy: 1}, {dx: 1, dy: -1}, {dx: -1, dy: -1}, {dx: -1, dy: 1}
      ]);
    }

    jumps.forEach(j => {
      const tx = piece.x + j.dx, ty = piece.y + j.dy;
      if (tx >= 0 && tx < gameState.board.width && ty >= 0 && ty < gameState.board.height) {
        const tgt = gameState.pieces.find(p => p.x === tx && p.y === ty);
        if (!tgt || tgt.team !== piece.team) moves.push({x: tx, y: ty});
      }
    });
  }
  return moves;
}

function handleCellClick(x, y) {
  if (gameState.turn !== 'player' || gameState.isDrafting) return;

  if (gameState.selectedPieceId && gameState.validMoves.some(m => m.x === x && m.y === y)) {
    movePiece(gameState.selectedPieceId, x, y);
    return;
  }

  const clicked = gameState.pieces.find(p => p.x === x && p.y === y);
  if (clicked && clicked.team === 'player') {
    gameState.selectedPieceId = clicked.id;
    gameState.validMoves = getValidMoves(clicked);
  } else {
    gameState.selectedPieceId = null;
    gameState.validMoves = [];
  }
  render();
}

function movePiece(id, tx, ty) {
  const piece = gameState.pieces.find(p => p.id === id);
  let killedEnemy = false;
  
  // Base Capture
  const tgtIdx = gameState.pieces.findIndex(p => p.x === tx && p.y === ty);
  if (tgtIdx !== -1) {
    const cap = gameState.pieces[tgtIdx];
    gameState.pieces.splice(tgtIdx, 1);
    if (cap.team === 'player') {
      log("YOU DIED.");
      document.getElementById('board').classList.add('shake');
      render(); return; 
    }
    killedEnemy = true;
    shakeScreen();
  }

  piece.x = tx; piece.y = ty;

  // PERK: Explosive Landing
  if (piece.team === 'player' && gameState.perks.includes('explosive')) {
    const adjs = [{x: tx+1, y: ty}, {x: tx-1, y: ty}, {x: tx, y: ty+1}, {x: tx, y: ty-1}];
    adjs.forEach(adj => {
      const idx = gameState.pieces.findIndex(p => p.team === 'enemy' && p.x === adj.x && p.y === adj.y);
      if (idx !== -1) {
        gameState.pieces.splice(idx, 1);
        killedEnemy = true;
        shakeScreen();
      }
    });
  }

  gameState.selectedPieceId = null; 
  gameState.validMoves = [];
  render();

  // Turn Progression
  if (piece.team === 'player') {
    if (gameState.pieces.filter(p => p.team === 'enemy').length === 0) {
      log("Wave Cleared!");
      gameState.level++;
      setTimeout(() => {
        if(gameState.level % 2 !== 0) triggerDraft(); // Draft every odd level
        else startLevel();
      }, 800);
    } else {
      // PERK: Bloodlust
      if (killedEnemy && gameState.perks.includes('bloodlust')) {
        log("BLOODLUST! Extra Turn!");
        gameState.turn = 'player';
      } else {
        gameState.turn = 'enemy';
        setTimeout(playEnemyTurn, 200); // Super fast AI response
      }
    }
  } else {
    gameState.turn = 'player';
  }
}

// --- AI LOGIC ---
function playEnemyTurn() {
  const enemies = gameState.pieces.filter(p => p.team === 'enemy');
  const player = gameState.pieces.find(p => p.team === 'player');
  if (!player || !enemies.length) return;

  let moves = [];

  enemies.forEach(enemy => {
    if (enemy.type === 'Pawn') {
      const fy = enemy.y + 1;
      // PROMOTION
      if (fy >= gameState.board.height) {
        enemy.type = 'Queen';
        log("Pawn Promoted!");
        render(); return;
      }
      const canCapL = (player.x === enemy.x - 1 && player.y === fy);
      const canCapR = (player.x === enemy.x + 1 && player.y === fy);
      const isFwdEmpty = !gameState.pieces.some(p => p.x === enemy.x && p.y === fy);

      if (canCapL) moves.push({ id: enemy.id, x: enemy.x - 1, y: fy, isCap: true });
      if (canCapR) moves.push({ id: enemy.id, x: enemy.x + 1, y: fy, isCap: true });
      if (isFwdEmpty) moves.push({ id: enemy.id, x: enemy.x, y: fy, isCap: false });
    } 
    else if (enemy.type === 'Queen') {
      // Queens relentlessly hunt you 1 step at a time
      let qx = enemy.x, qy = enemy.y;
      if (player.x > enemy.x) qx++; else if (player.x < enemy.x) qx--;
      if (player.y > enemy.y) qy++; else if (player.y < enemy.y) qy--;
      if (!gameState.pieces.some(p => p.team === 'enemy' && p.x === qx && p.y === qy)) {
        moves.push({ id: enemy.id, x: qx, y: qy, isCap: (qx === player.x && qy === player.y) });
      }
    }
  });

  if (moves.length > 0) {
    const caps = moves.filter(m => m.isCap);
    const pool = caps.length > 0 ? caps : moves;
    const move = pool[Math.floor(Math.random() * pool.length)];
    movePiece(move.id, move.x, move.y);
  } else {
    gameState.turn = 'player'; 
  }
}

// --- RENDER & UTILS ---
function render() {
  const b = document.getElementById('board');
  b.innerHTML = '';
  b.style.gridTemplateColumns = `repeat(${gameState.board.width}, 60px)`;
  b.style.gridTemplateRows = `repeat(${gameState.board.height}, 60px)`;

  for (let y = 0; y < gameState.board.height; y++) {
    for (let x = 0; x < gameState.board.width; x++) {
      const cell = document.createElement('div');
      cell.className = `cell ${(x+y)%2===0 ? 'light' : 'dark'}`;
      if (gameState.validMoves.some(m => m.x === x && m.y === y)) cell.classList.add('valid-move');
      
      const piece = gameState.pieces.find(p => p.x === x && p.y === y);
      if (piece) {
        const pEl = document.createElement('div');
        pEl.className = `piece ${piece.team}`;
        pEl.textContent = symbols[piece.type];
        if (piece.id === gameState.selectedPieceId) pEl.style.transform = 'scale(1.3)';
        cell.appendChild(pEl);
      }
      cell.onclick = () => handleCellClick(x, y);
      b.appendChild(cell);
    }
  }
}

function shakeScreen() {
  const b = document.getElementById('board');
  b.classList.remove('shake');
  void b.offsetWidth; // trigger reflow
  b.classList.add('shake');
}

function log(msg) { document.getElementById('message-log').textContent = msg; }
document.getElementById('reset-btn').addEventListener('click', initGame);

// Start
initGame();