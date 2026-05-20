let gameState = {
  level: 1, board: { width: 5, height: 5 }, pieces: [],
  selectedPieceId: null, validMoves: [], turn: 'player',
  perks: [], playerType: 'Knight', isDrafting: false
};

const symbols = { Knight: '♞', Pawn: '♟', Queen: '♛', Paladin: '🛡️', Archbishop: '♗', Chancellor: '♖' };

const gambitPool = [
  { id: 'bloodlust', icon: '🩸', title: 'Bloodlust', desc: 'Extra turn immediately after a kill.' },
  { id: 'explosive', icon: '💣', title: 'Explosive Landing', desc: 'Landing obliterates adjacent enemies.' },
  { id: 'agile', icon: '⚡', title: 'Agile Steed', desc: 'Add 1-square King movement in all directions.' },
  { id: 'cleave', icon: '🪓', title: 'Cleave', desc: 'Capturing an enemy also destroys all enemies adjacent to IT.' },
  { id: 'momentum', icon: '💨', title: 'Momentum', desc: 'First non-capture move per turn grants an extra action.' }
];

const evolutionPool = [
  { id: 'Paladin', icon: '🛡️', title: 'The Paladin', desc: 'Evolve! Moves as Knight + King.' },
  { id: 'Archbishop', icon: '♗', title: 'The Archbishop', desc: 'Evolve! Moves as Knight + Bishop.' },
  { id: 'Chancellor', icon: '♖', title: 'The Chancellor', desc: 'Evolve! Moves as Knight + Rook.' }
];

function initGame() {
  gameState.level = 1; gameState.board = { width: 5, height: 5 };
  gameState.perks = []; gameState.playerType = 'Knight';
  triggerDraft('gambit'); 
}

function triggerDraft(type) {
  gameState.isDrafting = true;
  const container = document.getElementById('draft-cards');
  container.innerHTML = '';
  
  if (type === 'evolution') {
    document.getElementById('draft-title').textContent = `Level ${gameState.level}: PIECE EVOLUTION!`;
    evolutionPool.forEach(evo => {
      container.innerHTML += `<div class="card evolution" onclick="selectEvolution('${evo.id}')"><h3>${evo.icon} ${evo.title}</h3><p>${evo.desc}</p></div>`;
    });
  } else {
    document.getElementById('draft-title').textContent = `Level ${gameState.level}: Choose a Perk!`;
    const shuffled = [...gambitPool].sort(() => 0.5 - Math.random()).slice(0, 3);
    shuffled.forEach(gambit => {
      container.innerHTML += `<div class="card" onclick="selectGambit('${gambit.id}')"><h3>${gambit.icon} ${gambit.title}</h3><p>${gambit.desc}</p></div>`;
    });
  }
  document.getElementById('draft-screen').style.display = 'flex';
}

window.selectGambit = function(perk) {
  if (!gameState.perks.includes(perk)) gameState.perks.push(perk);
  finishDraft();
};

window.selectEvolution = function(newType) {
  gameState.playerType = newType;
  finishDraft();
};

function finishDraft() {
  document.getElementById('draft-screen').style.display = 'none';
  gameState.isDrafting = false;
  startLevel();
}

function startLevel() {
  gameState.turn = 'player'; gameState.selectedPieceId = null; gameState.validMoves = [];
  if (gameState.level === 3) gameState.board = { width: 6, height: 6 };
  if (gameState.level === 5) gameState.board = { width: 7, height: 7 };

  const px = Math.floor(gameState.board.width / 2), py = gameState.board.height - 1;
  gameState.pieces = [{ id: 'player', type: gameState.playerType, team: 'player', x: px, y: py }];

  const pawnCount = gameState.level + 2; 
  for (let i = 0; i < pawnCount; i++) spawnEnemy('Pawn', Math.floor(gameState.board.height / 2));
  if (gameState.level >= 2) spawnEnemy('Queen', 2);
  if (gameState.level >= 4) spawnEnemy('Queen', 2);

  log(`Level ${gameState.level} Start!` + ((gameState.level===3||gameState.level===5) ? " BOARD EXPANDED!" : ""));
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

function getValidMoves(piece) {
  let moves = [];
  const addJumps = (jumps) => {
    jumps.forEach(j => {
      const tx = piece.x + j.dx, ty = piece.y + j.dy;
      if (tx >= 0 && tx < gameState.board.width && ty >= 0 && ty < gameState.board.height) {
        const tgt = gameState.pieces.find(p => p.x === tx && p.y === ty);
        if (!tgt || tgt.team !== piece.team) moves.push({x: tx, y: ty});
      }
    });
  };
  const addSlides = (dx, dy) => {
    let tx = piece.x + dx, ty = piece.y + dy;
    while(tx >= 0 && tx < gameState.board.width && ty >= 0 && ty < gameState.board.height) {
      const tgt = gameState.pieces.find(p => p.x === tx && p.y === ty);
      if (!tgt) { moves.push({x: tx, y: ty}); } 
      else { if (tgt.team !== piece.team) moves.push({x: tx, y: ty}); break; }
      tx += dx; ty += dy;
    }
  };

  const knightJumps = [{dx: 1, dy: 2}, {dx: 2, dy: 1}, {dx: 2, dy: -1}, {dx: 1, dy: -2}, {dx: -1, dy: -2}, {dx: -2, dy: -1}, {dx: -2, dy: 1}, {dx: -1, dy: 2}];
  const kingJumps = [{dx: 0, dy: 1}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: -1, dy: 0}, {dx: 1, dy: 1}, {dx: 1, dy: -1}, {dx: -1, dy: -1}, {dx: -1, dy: 1}];

  if (piece.type === 'Knight') addJumps(knightJumps);
  if (piece.type === 'Paladin') { addJumps(knightJumps); addJumps(kingJumps); }
  if (piece.type === 'Archbishop') { addJumps(knightJumps); addSlides(1,1); addSlides(1,-1); addSlides(-1,1); addSlides(-1,-1); }
  if (piece.type === 'Chancellor') { addJumps(knightJumps); addSlides(1,0); addSlides(-1,0); addSlides(0,1); addSlides(0,-1); }
  if (gameState.perks.includes('agile') && piece.team === 'player') addJumps(kingJumps);

  return moves.filter((v,i,a) => a.findIndex(t => (t.x === v.x && t.y === v.y)) === i);
}

function handleCellClick(x, y) {
  if (gameState.turn !== 'player' || gameState.isDrafting) return;
  if (gameState.selectedPieceId && gameState.validMoves.some(m => m.x === x && m.y === y)) {
    movePiece(gameState.selectedPieceId, x, y); return;
  }
  const clicked = gameState.pieces.find(p => p.x === x && p.y === y);
  if (clicked && clicked.team === 'player') {
    gameState.selectedPieceId = clicked.id; gameState.validMoves = getValidMoves(clicked);
  } else {
    gameState.selectedPieceId = null; gameState.validMoves = [];
  }
  render();
}

function movePiece(id, tx, ty) {
  const piece = gameState.pieces.find(p => p.id === id);
  let killedEnemy = false, moveWasCapture = false;
  
  const tgtIdx = gameState.pieces.findIndex(p => p.x === tx && p.y === ty);
  if (tgtIdx !== -1) {
    const cap = gameState.pieces[tgtIdx];
    gameState.pieces.splice(tgtIdx, 1);
    if (cap.team === 'player') { log("YOU DIED."); document.getElementById('board').classList.add('shake'); render(); return; }
    killedEnemy = true; moveWasCapture = true; shakeScreen();
  }

  piece.x = tx; piece.y = ty;

  if (piece.team === 'enemy' && piece.type === 'Pawn' && piece.y === gameState.board.height - 1) {
    piece.type = 'Queen'; log("A Pawn promoted to a Queen!"); shakeScreen();
  }

  if (piece.team === 'player') {
    if (gameState.perks.includes('explosive')) {
      [{x: tx+1, y: ty}, {x: tx-1, y: ty}, {x: tx, y: ty+1}, {x: tx, y: ty-1}].forEach(adj => {
        const idx = gameState.pieces.findIndex(p => p.team === 'enemy' && p.x === adj.x && p.y === adj.y);
        if (idx !== -1) { gameState.pieces.splice(idx, 1); killedEnemy = true; shakeScreen(); }
      });
    }
    if (moveWasCapture && gameState.perks.includes('cleave')) {
      [{x: tx+1, y: ty}, {x: tx-1, y: ty}, {x: tx, y: ty+1}, {x: tx, y: ty-1}, {x: tx+1, y: ty+1}, {x: tx-1, y: ty-1}, {x: tx+1, y: ty-1}, {x: tx-1, y: ty+1}].forEach(adj => {
        const idx = gameState.pieces.findIndex(p => p.team === 'enemy' && p.x === adj.x && p.y === adj.y);
        if (idx !== -1) { gameState.pieces.splice(idx, 1); shakeScreen(); }
      });
    }
  }

  gameState.selectedPieceId = null; gameState.validMoves = []; render();

  if (piece.team === 'player') {
    if (gameState.pieces.filter(p => p.team === 'enemy').length === 0) {
      log("Wave Cleared!"); gameState.level++;
      setTimeout(() => { (gameState.level === 3 || gameState.level === 6) ? triggerDraft('evolution') : triggerDraft('gambit'); }, 800);
    } else {
      if (killedEnemy && gameState.perks.includes('bloodlust')) {
        log("BLOODLUST! Extra Turn!"); gameState.turn = 'player';
      } else if (!killedEnemy && gameState.perks.includes('momentum') && !gameState.momentumUsedThisTurn) {
        log("MOMENTUM! Quick step."); gameState.momentumUsedThisTurn = true; gameState.turn = 'player';
      } else {
        gameState.turn = 'enemy'; gameState.momentumUsedThisTurn = false; setTimeout(playEnemyTurn, 200); 
      }
    }
  } else {
    gameState.turn = 'player';
  }
}

// --- LETHAL AI LOGIC ---
function playEnemyTurn() {
  const enemies = gameState.pieces.filter(p => p.team === 'enemy');
  const player = gameState.pieces.find(p => p.team === 'player');
  if (!player || !enemies.length) return;

  // 1. CHECK FOR LETHAL BLUNDERS FIRST
  for (let enemy of enemies) {
    if (enemy.type === 'Pawn') {
      if (player.y === enemy.y + 1 && (player.x === enemy.x - 1 || player.x === enemy.x + 1)) {
        movePiece(enemy.id, player.x, player.y); return; // Execute lethal diagonal pawn capture immediately
      }
    } else if (enemy.type === 'Queen') {
      const dx = Math.sign(player.x - enemy.x), dy = Math.sign(player.y - enemy.y);
      // Are they on the same line/diagonal?
      if (dx === 0 || dy === 0 || Math.abs(player.x - enemy.x) === Math.abs(player.y - enemy.y)) {
        let clear = true, cx = enemy.x + dx, cy = enemy.y + dy;
        while (cx !== player.x || cy !== player.y) { // Raycast to see if path is blocked
          if (gameState.pieces.some(p => p.x === cx && p.y === cy)) { clear = false; break; }
          cx += dx; cy += dy;
        }
        if (clear) { movePiece(enemy.id, player.x, player.y); return; } // SNIPED
      }
    }
  }

  // 2. STANDARD MOVEMENT (If no lethal capture exists)
  let moves = [];
  enemies.forEach(enemy => {
    if (enemy.type === 'Pawn') {
      const fy = enemy.y + 1;
      if (fy < gameState.board.height && !gameState.pieces.some(p => p.x === enemy.x && p.y === fy)) {
        moves.push({ id: enemy.id, x: enemy.x, y: fy });
      }
    } else if (enemy.type === 'Queen') {
      let qx = enemy.x, qy = enemy.y;
      if (player.x > enemy.x) qx++; else if (player.x < enemy.x) qx--;
      if (player.y > enemy.y) qy++; else if (player.y < enemy.y) qy--;
      if (!gameState.pieces.some(p => p.team === 'enemy' && p.x === qx && p.y === qy)) {
        moves.push({ id: enemy.id, x: qx, y: qy });
      }
    }
  });

  if (moves.length > 0) {
    const move = moves[Math.floor(Math.random() * moves.length)];
    movePiece(move.id, move.x, move.y);
  } else {
    gameState.turn = 'player'; 
  }
}

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
  
  // Render Active Perks Tray
  const tray = document.getElementById('active-perks');
  tray.innerHTML = '';
  gameState.perks.forEach(perkId => {
    const p = gambitPool.find(g => g.id === perkId);
    if (p) tray.innerHTML += `<div class="active-perk-card"><h4>${p.icon} ${p.title}</h4><p>${p.desc}</p></div>`;
  });
}

function shakeScreen() {
  const b = document.getElementById('board');
  b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
}

function log(msg) { document.getElementById('message-log').textContent = msg; }
document.getElementById('reset-btn').addEventListener('click', initGame);

initGame();