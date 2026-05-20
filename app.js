// --- STATE ---
let gameState = {
  level: 1, board: { width: 5, height: 5 }, pieces: [],
  selectedPieceId: null, validMoves: [], turn: 'player',
  perks: [], playerType: 'Knight', isDrafting: false,
  bloodlustUsed: 0 // Prevents infinite turn loops
};

// Added Bishop and Rook
const symbols = { Knight: '♞', Pawn: '♟', Queen: '♛', Bishop: '♝', Rook: '♜', Paladin: '🛡️', Archbishop: '♗', Chancellor: '♖' };

const gambitPool = [
  { id: 'bloodlust', icon: '🩸', title: 'Bloodlust', desc: 'Once per round, gain an extra turn after a kill.' },
  { id: 'explosive', icon: '💣', title: 'Explosive Landing', desc: 'Landing obliterates adjacent enemies.' },
  { id: 'agile', icon: '⚡', title: 'Agile Steed', desc: 'Add 1-square King movement in all directions.' },
  { id: 'cleave', icon: '🪓', title: 'Cleave', desc: 'Captures destroy all surrounding enemies.' },
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
  gameState.bloodlustUsed = 0;

  if (gameState.level === 3) gameState.board = { width: 6, height: 6 };
  if (gameState.level === 5) gameState.board = { width: 7, height: 7 };

  const px = Math.floor(gameState.board.width / 2), py = gameState.board.height - 1;
  gameState.pieces = [{ id: 'player', type: gameState.playerType, team: 'player', x: px, y: py }];

  // Difficulty Scaling
  const pawnCount = gameState.level + 1; 
  for (let i = 0; i < pawnCount; i++) spawnEnemy('Pawn', Math.floor(gameState.board.height / 2));
  
  if (gameState.level >= 2) spawnEnemy('Queen', 2);
  if (gameState.level >= 3) spawnEnemy('Rook', 3); // Armored Tanks spawn
  if (gameState.level >= 4) spawnEnemy('Bishop', 3); // Cross-map Snipers spawn
  if (gameState.level >= 5) spawnEnemy('Queen', 2);

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

// Reusable logic to handle splash damage against Armored units
function applySplashDamage(x, y) {
  const idx = gameState.pieces.findIndex(p => p.team === 'enemy' && p.x === x && p.y === y);
  if (idx !== -1) { 
    if (gameState.pieces[idx].type === 'Rook') {
        log("An Armored Rook deflected the explosion!");
        return false; // Did not kill
    } else {
        gameState.pieces.splice(idx, 1); 
        shakeScreen(); 
        return true; // Killed
    }
  }
  return false;
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
        if (applySplashDamage(adj.x, adj.y)) killedEnemy = true;
      });
    }
    if (moveWasCapture && gameState.perks.includes('cleave')) {
      [{x: tx+1, y: ty}, {x: tx-1, y: ty}, {x: tx, y: ty+1}, {x: tx, y: ty-1}, {x: tx+1, y: ty+1}, {x: tx-1, y: ty-1}, {x: tx+1, y: ty-1}, {x: tx-1, y: ty+1}].forEach(adj => {
        applySplashDamage(adj.x, adj.y);
      });
    }
  }

  gameState.selectedPieceId = null; gameState.validMoves = []; render();

  if (piece.team === 'player') {
    if (gameState.pieces.filter(p => p.team === 'enemy').length === 0) {
      log("Wave Cleared!"); gameState.level++;
      setTimeout(() => { (gameState.level === 3 || gameState.level === 6) ? triggerDraft('evolution') : triggerDraft('gambit'); }, 800);
    } else {
      // BLOODLUST FATIGUE: Hard capped at 1 trigger per round.
      if (killedEnemy && gameState.perks.includes('bloodlust') && gameState.bloodlustUsed < 1) {
        log("BLOODLUST! 1 Extra Turn!"); 
        gameState.bloodlustUsed++; 
        gameState.turn = 'player';
      } else if (!killedEnemy && gameState.perks.includes('momentum') && !gameState.momentumUsedThisTurn) {
        log("MOMENTUM! Quick step."); gameState.momentumUsedThisTurn = true; gameState.turn = 'player';
      } else {
        gameState.turn = 'enemy'; 
        gameState.momentumUsedThisTurn = false; 
        gameState.bloodlustUsed = 0; // Reset fatigue
        setTimeout(playEnemyTurn, 200); 
      }
    }
  } else {
    gameState.turn = 'player';
  }
}

// --- ADVANCED AI LOGIC ---
function playEnemyTurn() {
  const enemies = gameState.pieces.filter(p => p.team === 'enemy');
  const player = gameState.pieces.find(p => p.team === 'player');
  if (!player || !enemies.length) return;

  // Reusable Raycaster for Lethal Checks
  const checkLethalRay = (enemy, dirs) => {
    for (let d of dirs) {
      let cx = enemy.x + d.dx, cy = enemy.y + d.dy;
      while (cx >= 0 && cx < gameState.board.width && cy >= 0 && cy < gameState.board.height) {
        if (cx === player.x && cy === player.y) return {x: cx, y: cy}; // Lethal found
        if (gameState.pieces.some(p => p.x === cx && p.y === cy)) break; // Line of sight blocked
        cx += d.dx; cy += d.dy;
      }
    }
    return null;
  };

  const straights = [{dx: 0, dy: 1}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: -1, dy: 0}];
  const diagonals = [{dx: 1, dy: 1}, {dx: 1, dy: -1}, {dx: -1, dy: -1}, {dx: -1, dy: 1}];

  // 1. EXECUTE LETHAL BLUNDERS FIRST
  for (let enemy of enemies) {
    if (enemy.type === 'Pawn') {
      if (player.y === enemy.y + 1 && (player.x === enemy.x - 1 || player.x === enemy.x + 1)) {
        movePiece(enemy.id, player.x, player.y); return; 
      }
    } else if (enemy.type === 'Bishop') {
      let lethal = checkLethalRay(enemy, diagonals);
      if (lethal) { movePiece(enemy.id, lethal.x, lethal.y); return; }
    } else if (enemy.type === 'Rook') {
      let lethal = checkLethalRay(enemy, straights);
      if (lethal) { movePiece(enemy.id, lethal.x, lethal.y); return; }
    } else if (enemy.type === 'Queen') {
      let lethal = checkLethalRay(enemy, [...straights, ...diagonals]);
      if (lethal) { movePiece(enemy.id, lethal.x, lethal.y); return; }
    }
  }

  // 2. STANDARD MOVEMENT
  let moves = [];
  enemies.forEach(enemy => {
    if (enemy.type === 'Pawn') {
      const fy = enemy.y + 1;
      if (fy < gameState.board.height && !gameState.pieces.some(p => p.x === enemy.x && p.y === fy)) {
        moves.push({ id: enemy.id, x: enemy.x, y: fy });
      }
    } else if (enemy.type === 'Queen' || enemy.type === 'Rook') {
      // Queens and Rooks hunt you on straights
      let tx = enemy.x, ty = enemy.y;
      if (player.x > enemy.x) tx++; else if (player.x < enemy.x) tx--;
      if (player.y > enemy.y) ty++; else if (player.y < enemy.y) ty--;
      
      // If it's a Rook, it only wants to move on straights, not diagonals
      if (enemy.type === 'Rook') {
        if (Math.abs(player.x - enemy.x) > Math.abs(player.y - enemy.y)) ty = enemy.y; else tx = enemy.x;
      }
      
      if (!gameState.pieces.some(p => p.team === 'enemy' && p.x === tx && p.y === ty)) {
        moves.push({ id: enemy.id, x: tx, y: ty });
      }
    } else if (enemy.type === 'Bishop') {
      // Bishops shimmy diagonally toward you
      let dx = player.x > enemy.x ? 1 : -1;
      let dy = player.y > enemy.y ? 1 : -1;
      let tx = enemy.x + dx, ty = enemy.y + dy;
      if (tx >= 0 && tx < gameState.board.width && ty >= 0 && ty < gameState.board.height) {
          if (!gameState.pieces.some(p => p.team === 'enemy' && p.x === tx && p.y === ty)) {
            moves.push({ id: enemy.id, x: tx, y: ty });
          }
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
        
        // Add a visual CSS identifier for the Armored Rooks
        if (piece.type === 'Rook') pEl.style.textShadow = "0 0 10px rgba(255, 0, 0, 0.8)";
        
        if (piece.id === gameState.selectedPieceId) pEl.style.transform = 'scale(1.3)';
        cell.appendChild(pEl);
      }
      cell.onclick = () => handleCellClick(x, y);
      b.appendChild(cell);
    }
  }
  
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