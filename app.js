// --- STATE & SCORING ---
let gameState = {
  level: 1, board: { width: 5, height: 5 }, pieces: [],
  selectedPieceId: null, validMoves: [], turn: 'player',
  perks: [], playerType: 'Knight', isDrafting: false,
  bloodlustUsed: 0,
  momentumUsed: 0,
  score: 0,
  levelTurnCount: 0 
};

// Persistent Stats
let bestScore = parseInt(localStorage.getItem('chessrl_bestscore')) || 0;
let bestLevel = parseInt(localStorage.getItem('chessrl_bestlevel')) || 1;

const symbols = { Knight: '♞', Pawn: '♟', Queen: '♛', Bishop: '♝', Rook: '♜', Paladin: '🛡️', Archbishop: '♗', Chancellor: '♖' };

// --- LEVEL-UP GAMBIT POOL ---
const gambitPool = [
  { id: 'bloodlust', icon: '🩸', title: 'Bloodlust', maxLevel: 3, getDesc: (lvl) => `Gain an extra turn after a kill (Max ${lvl}/round).` },
  { id: 'explosive', icon: '💣', title: 'Explosive Landing', maxLevel: 1, getDesc: () => `Landing obliterates adjacent enemies.` },
  { id: 'agile', icon: '⚡', title: 'Agile Steed', maxLevel: 1, getDesc: () => `Add 1-square King movement in all directions.` },
  { id: 'cleave', icon: '🪓', title: 'Cleave', maxLevel: 1, getDesc: () => `Captures destroy all surrounding enemies.` },
  { id: 'momentum', icon: '💨', title: 'Momentum', maxLevel: 3, getDesc: (lvl) => `First non-capture move per turn grants an extra action (Max ${lvl}/round).` }
];

const evolutionPool = [
  { id: 'Archbishop', icon: '♗', title: 'The Archbishop', desc: 'Evolve! Moves as Knight + Bishop.' },
  { id: 'Chancellor', icon: '♖', title: 'The Chancellor', desc: 'Evolve! Moves as Knight + Rook.' }
];

// Helper function to check perk levels
function getPerkLevel(id) {
  return gameState.perks.filter(p => p === id).length;
}

function updateHUD() {
  document.getElementById('hud-level').textContent = gameState.level;
  const scoreEl = document.getElementById('hud-score');
  scoreEl.textContent = gameState.score;
  document.getElementById('hud-best-lvl').textContent = bestLevel;
  document.getElementById('hud-best-score').textContent = bestScore;
}

function addScore(points, isBonus = false) {
  gameState.score += points;
  const scoreEl = document.getElementById('hud-score');
  scoreEl.textContent = gameState.score;
  
  if (isBonus) {
    scoreEl.classList.remove('score-pop');
    void scoreEl.offsetWidth; 
    scoreEl.classList.add('score-pop');
  }

  if (gameState.score > bestScore) {
    bestScore = gameState.score;
    localStorage.setItem('chessrl_bestscore', bestScore);
  }
  updateHUD();
}

function updateBestLevel() {
  if (gameState.level > bestLevel) {
    bestLevel = gameState.level;
    localStorage.setItem('chessrl_bestlevel', bestLevel);
    updateHUD();
  }
}

function initGame() {
  gameState.level = 1; gameState.score = 0; gameState.board = { width: 5, height: 5 };
  gameState.perks = []; gameState.playerType = 'Knight';
  updateHUD();
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
    
    // Filter out perks that have hit their max level
    const availableGambits = gambitPool.filter(g => getPerkLevel(g.id) < g.maxLevel);
    if (availableGambits.length === 0) { finishDraft(); return; } 
    
    const shuffled = [...availableGambits].sort(() => 0.5 - Math.random()).slice(0, 3);
    shuffled.forEach(gambit => {
      const currentLvl = getPerkLevel(gambit.id);
      const nextLvl = currentLvl + 1;
      
      // Added a line break and scaled down the text slightly for the level indicator
      const titleSuffix = gambit.maxLevel > 1 ? `<br><span style="color:#ffd700; font-size: 0.85em;">(Lv ${nextLvl})</span>` : '';
      
      container.innerHTML += `
        <div class="card" onclick="selectGambit('${gambit.id}')">
          <h3>${gambit.icon} ${gambit.title}${titleSuffix}</h3>
          <p>${gambit.getDesc(nextLvl)}</p>
        </div>`;
    });
  }
  document.getElementById('draft-screen').style.display = 'flex';
}

window.selectGambit = function(perk) { gameState.perks.push(perk); finishDraft(); };
window.selectEvolution = function(newType) { gameState.playerType = newType; finishDraft(); };

function finishDraft() {
  document.getElementById('draft-screen').style.display = 'none';
  gameState.isDrafting = false;
  startLevel();
}

function startLevel() {
  gameState.turn = 'player'; gameState.selectedPieceId = null; gameState.validMoves = [];
  gameState.bloodlustUsed = 0; gameState.momentumUsed = 0; gameState.levelTurnCount = 0;

  if (gameState.level === 3) gameState.board = { width: 6, height: 6 };
  if (gameState.level === 5) gameState.board = { width: 7, height: 7 };

  const px = Math.floor(gameState.board.width / 2), py = gameState.board.height - 1;
  gameState.pieces = [{ id: 'player', type: gameState.playerType, team: 'player', x: px, y: py }];

  const pawnCount = gameState.level + 1; 
  for (let i = 0; i < pawnCount; i++) spawnEnemy('Pawn', Math.floor(gameState.board.height / 2));
  if (gameState.level >= 2) spawnEnemy('Queen', 2);
  if (gameState.level >= 3) spawnEnemy('Rook', 3); 
  if (gameState.level >= 4) spawnEnemy('Bishop', 3); 
  if (gameState.level >= 5) spawnEnemy('Queen', 2);

  updateBestLevel();
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
  if (piece.team === 'player' && gameState.perks.includes('agile')) addJumps(kingJumps);

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
  let multiKillCount = 0;
  
  if (piece.team === 'player') gameState.levelTurnCount++; 

  const tgtIdx = gameState.pieces.findIndex(p => p.x === tx && p.y === ty);
  if (tgtIdx !== -1) {
    const cap = gameState.pieces[tgtIdx];
    gameState.pieces.splice(tgtIdx, 1);
    if (cap.team === 'player') { log("YOU DIED. Final Score: " + gameState.score); document.getElementById('board').classList.add('shake'); render(); return; }
    killedEnemy = true; moveWasCapture = true; multiKillCount++; shakeScreen();
  }

  piece.x = tx; piece.y = ty;

  if (piece.team === 'enemy' && piece.type === 'Pawn' && piece.y === gameState.board.height - 1) {
    piece.type = 'Queen'; log("A Pawn promoted to a Queen!"); shakeScreen();
  }

  if (piece.team === 'player') {
    if (gameState.perks.includes('explosive')) {
      [{x: tx+1, y: ty}, {x: tx-1, y: ty}, {x: tx, y: ty+1}, {x: tx, y: ty-1}, 
       {x: tx+1, y: ty+1}, {x: tx-1, y: ty-1}, {x: tx+1, y: ty-1}, {x: tx-1, y: ty+1}].forEach(adj => {
        const idx = gameState.pieces.findIndex(p => p.team === 'enemy' && p.x === adj.x && p.y === adj.y);
        if (idx !== -1) { gameState.pieces.splice(idx, 1); killedEnemy = true; multiKillCount++; shakeScreen(); }
      });
    }
    
    if (moveWasCapture && gameState.perks.includes('cleave')) {
      [{x: tx+1, y: ty}, {x: tx-1, y: ty}, {x: tx, y: ty+1}, {x: tx, y: ty-1}, 
       {x: tx+1, y: ty+1}, {x: tx-1, y: ty-1}, {x: tx+1, y: ty-1}, {x: tx-1, y: ty+1}].forEach(adj => {
        const idx = gameState.pieces.findIndex(p => p.team === 'enemy' && p.x === adj.x && p.y === adj.y);
        if (idx !== -1) { gameState.pieces.splice(idx, 1); multiKillCount++; shakeScreen(); }
      });
    }
    
    if (multiKillCount > 0) {
        addScore(10 * multiKillCount); 
        if (multiKillCount > 1) { addScore(20, true); log(`MULTI-KILL! +20 Pts`); }
    }
  }

  gameState.selectedPieceId = null; gameState.validMoves = []; render();

  if (piece.team === 'player') {
    if (gameState.pieces.filter(p => p.team === 'enemy').length === 0) {
      let baseClear = 50;
      let efficiencyBonus = Math.max(0, 100 - (gameState.levelTurnCount * 5));
      addScore(baseClear + efficiencyBonus, true);
      
      log(`Wave Cleared! Turn Bonus: +${efficiencyBonus} pts`);
      gameState.level++;
      setTimeout(() => { (gameState.level === 3 || gameState.level === 6) ? triggerDraft('evolution') : triggerDraft('gambit'); }, 1200);
    } else {
      
      const blLevel = getPerkLevel('bloodlust');
      const momLevel = getPerkLevel('momentum');

      if (killedEnemy && blLevel > 0 && gameState.bloodlustUsed < blLevel) {
        gameState.bloodlustUsed++; 
        log(`BLOODLUST! (${gameState.bloodlustUsed}/${blLevel}) Extra Turn!`); 
        gameState.turn = 'player';
      } else if (!killedEnemy && momLevel > 0 && gameState.momentumUsed < momLevel) {
        gameState.momentumUsed++; 
        log(`MOMENTUM! (${gameState.momentumUsed}/${momLevel}) Quick step.`); 
        gameState.turn = 'player';
      } else {
        gameState.turn = 'enemy'; 
        gameState.momentumUsed = 0; 
        gameState.bloodlustUsed = 0; 
        setTimeout(playEnemyTurn, 100); 
      }
    }
  } else {
    gameState.turn = 'player';
  }
}

function playEnemyTurn() {
  const enemies = gameState.pieces.filter(p => p.team === 'enemy');
  const player = gameState.pieces.find(p => p.team === 'player');
  if (!player || !enemies.length) return;

  const playerThreats = getValidMoves(player).map(m => `${m.x},${m.y}`);
  let allPossibleMoves = [];

  const addEnemySlides = (enemy, dx, dy) => {
    let tx = enemy.x + dx, ty = enemy.y + dy;
    while(tx >= 0 && tx < gameState.board.width && ty >= 0 && ty < gameState.board.height) {
      if (tx === player.x && ty === player.y) { allPossibleMoves.push({ id: enemy.id, x: tx, y: ty, isLethal: true }); break; }
      if (gameState.pieces.some(p => p.x === tx && p.y === ty)) break; 
      allPossibleMoves.push({ id: enemy.id, x: tx, y: ty, isLethal: false });
      tx += dx; ty += dy;
    }
  };

  enemies.forEach(enemy => {
    if (enemy.type === 'Pawn') {
      const fy = enemy.y + 1;
      if (fy < gameState.board.height) {
        if (!gameState.pieces.some(p => p.x === enemy.x && p.y === fy)) allPossibleMoves.push({ id: enemy.id, x: enemy.x, y: fy, isLethal: false }); 
        if (player.y === fy && (player.x === enemy.x - 1 || player.x === enemy.x + 1)) allPossibleMoves.push({ id: enemy.id, x: player.x, y: fy, isLethal: true }); 
      }
    } else if (enemy.type === 'Queen') {
      [{dx: 0,dy: 1},{dx: 1,dy: 0},{dx: 0,dy: -1},{dx: -1,dy: 0},{dx: 1,dy: 1},{dx: 1,dy: -1},{dx: -1,dy: -1},{dx: -1,dy: 1}].forEach(d => addEnemySlides(enemy, d.dx, d.dy));
    } else if (enemy.type === 'Rook') {
      [{dx: 0,dy: 1},{dx: 1,dy: 0},{dx: 0,dy: -1},{dx: -1,dy: 0}].forEach(d => addEnemySlides(enemy, d.dx, d.dy));
    } else if (enemy.type === 'Bishop') {
      [{dx: 1,dy: 1},{dx: 1,dy: -1},{dx: -1,dy: -1},{dx: -1,dy: 1}].forEach(d => addEnemySlides(enemy, d.dx, d.dy));
    }
  });

  if (allPossibleMoves.length > 0) {
    const lethalMove = allPossibleMoves.find(m => m.isLethal);
    if (lethalMove) { movePiece(lethalMove.id, lethalMove.x, lethalMove.y); return; }

    let bestMove = null, highestScore = -Infinity;
    allPossibleMoves.forEach(move => {
      let score = 0;
      const currentlyThreatened = playerThreats.includes(`${gameState.pieces.find(p=>p.id===move.id).x},${gameState.pieces.find(p=>p.id===move.id).y}`);
      const moveIsSafe = !playerThreats.includes(`${move.x},${move.y}`);
      
      if (currentlyThreatened && moveIsSafe) score += 50; 
      if (!currentlyThreatened && !moveIsSafe) score -= 100; 
      score -= (Math.abs(player.x - move.x) + Math.abs(player.y - move.y)); 

      if (score > highestScore) { highestScore = score; bestMove = move; }
      else if (score === highestScore && Math.random() > 0.5) { bestMove = move; } 
    });

    if (bestMove) { movePiece(bestMove.id, bestMove.x, bestMove.y); return; }
  }
  
  gameState.turn = 'player'; 
  gameState.momentumUsed = 0; 
  gameState.bloodlustUsed = 0; 
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
  
  const tray = document.getElementById('active-perks');
  tray.innerHTML = '';
  const uniquePerks = [...new Set(gameState.perks)];
  uniquePerks.forEach(perkId => {
    const p = gambitPool.find(g => g.id === perkId);
    if (p) {
      const lvl = getPerkLevel(perkId);
      
      // Also apply line break to the tray for consistency
      const titleSuffix = p.maxLevel > 1 ? `<br><span style="color:#ffd700; font-size: 0.85em;">(Lv ${lvl})</span>` : '';
      tray.innerHTML += `<div class="active-perk-card"><h4>${p.icon} ${p.title}${titleSuffix}</h4><p>${p.getDesc(lvl)}</p></div>`;
    }
  });
}

function shakeScreen() {
  const b = document.getElementById('board');
  b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
}

function log(msg) { document.getElementById('message-log').textContent = msg; }

// Modals and Boot
document.getElementById('reset-btn').addEventListener('click', initGame);
const modal = document.getElementById('help-modal');
document.getElementById('help-btn').addEventListener('click', () => modal.style.display = 'flex');
document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e; document.getElementById('install-btn').style.display = 'block';
});
document.getElementById('install-btn').addEventListener('click', async () => {
  if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') document.getElementById('install-btn').style.display = 'none'; deferredPrompt = null; }
});

updateHUD(); initGame();