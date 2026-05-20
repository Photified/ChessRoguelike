// --- STATE & SCORING ---
let gameState = {
  level: 1, board: { width: 5, height: 5 }, pieces: [],
  selectedPieceId: null, validMoves: [], turn: 'player',
  perks: [], playerType: 'Knight', isDrafting: false,
  bloodlustUsed: 0, momentumUsed: 0, score: 0, levelTurnCount: 0,
  
  // New Mechanics State
  voidSquares: [], turnsSinceCapture: 0, 
  suddenDeathActive: false, suddenDeathTimer: 0, suddenDeathRing: 0,
  isPlacingTrap: false, trapsToPlace: 0, trapUsedThisRound: false
};

// Persistent Stats
let bestScore = parseInt(localStorage.getItem('chessrl_bestscore')) || 0;
let bestLevel = parseInt(localStorage.getItem('chessrl_bestlevel')) || 1;

const symbols = { Knight: '♞', Pawn: '♟', Queen: '♛', Bishop: '♝', Rook: '♜', Archbishop: '♗', Chancellor: '♖', King: '♚' };

// --- LEVEL-UP GAMBIT POOL ---
const gambitPool = [
  { id: 'bloodlust', icon: '🩸', title: 'Bloodlust', maxLevel: 3, getDesc: (lvl) => `Gain an extra turn after a kill (Max ${lvl}/round).` },
  { id: 'cleave', icon: '🪓', title: 'Cleave', maxLevel: 2, getDesc: (lvl) => lvl === 1 ? `Captures destroy all surrounding enemies.` : `All landings obliterate adjacent enemies.` },
  { id: 'trap', icon: '🕳️', title: 'Abyssal Trap', maxLevel: 3, getDesc: (lvl) => `Activate to place ${lvl} permanent Void Block(s) on the board.` },
  { id: 'agile', icon: '⚡', title: 'Agile Steed', maxLevel: 1, getDesc: () => `Add 1-square King movement in all directions.` },
  { id: 'momentum', icon: '💨', title: 'Momentum', maxLevel: 3, getDesc: (lvl) => `First non-capture move per turn grants an extra action (Max ${lvl}/round).` }
];

const evolutionPool = [
  { id: 'Archbishop', icon: '♗', title: 'The Archbishop', desc: 'Evolve! Moves as Knight + Bishop.' },
  { id: 'Chancellor', icon: '♖', title: 'The Chancellor', desc: 'Evolve! Moves as Knight + Rook.' }
];

function getPerkLevel(id) { return gameState.perks.filter(p => p === id).length; }

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

// --- BOOT & HOME SCREEN LOGIC ---
function bootApp() {
  gameState.level = 1; gameState.score = 0; gameState.board = { width: 5, height: 5 };
  
  // Render a dummy board for the home screen
  gameState.pieces = [{ id: 'dummy', type: 'Knight', team: 'player', x: 2, y: 4 }];
  gameState.turn = 'home'; // Prevents board interaction
  
  updateHUD();
  render();
  
  // Show Home UI, Hide Game UI
  document.getElementById('home-screen-actions').style.display = 'flex';
  document.getElementById('message-log').style.display = 'none';
  document.getElementById('active-perks').style.display = 'none';
}

function initGame() {
  // Hide Home UI, Show Game UI
  document.getElementById('home-screen-actions').style.display = 'none';
  document.getElementById('message-log').style.display = 'block';
  document.getElementById('active-perks').style.display = 'grid'; // Uses the new CSS grid

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
    const availableGambits = gambitPool.filter(g => getPerkLevel(g.id) < g.maxLevel);
    if (availableGambits.length === 0) { finishDraft(); return; } 
    
    const shuffled = [...availableGambits].sort(() => 0.5 - Math.random()).slice(0, 3);
    shuffled.forEach(gambit => {
      const currentLvl = getPerkLevel(gambit.id);
      const nextLvl = currentLvl + 1;
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
window.activateTrap = function() {
  if (gameState.turn !== 'player' || gameState.trapUsedThisRound || gameState.isDrafting) return;
  gameState.isPlacingTrap = true;
  gameState.trapsToPlace = getPerkLevel('trap');
  log(`Tap empty squares to place ${gameState.trapsToPlace} Abyssal Trap(s)!`);
};

function finishDraft() {
  document.getElementById('draft-screen').style.display = 'none';
  gameState.isDrafting = false;
  startLevel();
}

function startLevel() {
  gameState.turn = 'player'; gameState.selectedPieceId = null; gameState.validMoves = [];
  gameState.bloodlustUsed = 0; gameState.momentumUsed = 0; gameState.levelTurnCount = 0;
  
  gameState.voidSquares = []; gameState.turnsSinceCapture = 0;
  gameState.suddenDeathActive = false; gameState.suddenDeathTimer = 0; gameState.suddenDeathRing = 0;
  gameState.isPlacingTrap = false; gameState.trapUsedThisRound = false;

  const isBossLevel = gameState.level % 5 === 0;

  if (gameState.level === 3) gameState.board = { width: 6, height: 6 };
  if (gameState.level >= 5) gameState.board = { width: 7, height: 7 };

  const px = Math.floor(gameState.board.width / 2), py = gameState.board.height - 1;
  gameState.pieces = [{ id: 'player', type: gameState.playerType, team: 'player', x: px, y: py }];

  if (isBossLevel) {
    const bossHp = 3 + (Math.floor(gameState.level / 5) - 1) * 2;
    const bx = Math.floor(gameState.board.width / 2);
    const by = 0;
    
    gameState.pieces.push({ id: 'boss', type: 'King', team: 'enemy', x: bx, y: by, hp: bossHp, isBoss: true });
    gameState.pieces.push({ id: 'guard1', type: 'Rook', team: 'enemy', x: Math.max(0, bx - 1), y: by });
    gameState.pieces.push({ id: 'guard2', type: 'Rook', team: 'enemy', x: Math.min(gameState.board.width - 1, bx + 1), y: by });
    log(`WARNING: Boss Wave! Defeat the King!`);
  } else {
    const pawnCount = gameState.level + 1; 
    for (let i = 0; i < pawnCount; i++) spawnEnemy('Pawn', Math.floor(gameState.board.height / 2));
    if (gameState.level >= 2) spawnEnemy('Queen', 2);
    if (gameState.level >= 3) spawnEnemy('Rook', 3); 
    if (gameState.level >= 4) spawnEnemy('Bishop', 3); 
    log(`Level ${gameState.level} Start!` + ((gameState.level===3||gameState.level===5) ? " BOARD EXPANDED!" : ""));
  }

  updateBestLevel();
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
        if (!gameState.voidSquares.some(v => v.x === tx && v.y === ty)) {
          const tgt = gameState.pieces.find(p => p.x === tx && p.y === ty);
          if (!tgt || tgt.team !== piece.team) moves.push({x: tx, y: ty});
        }
      }
    });
  };
  const addSlides = (dx, dy) => {
    let tx = piece.x + dx, ty = piece.y + dy;
    while(tx >= 0 && tx < gameState.board.width && ty >= 0 && ty < gameState.board.height) {
      if (gameState.voidSquares.some(v => v.x === tx && v.y === ty)) break; // Blocked by Void
      const tgt = gameState.pieces.find(p => p.x === tx && p.y === ty);
      if (!tgt) { moves.push({x: tx, y: ty}); } 
      else { if (tgt.team !== piece.team) moves.push({x: tx, y: ty}); break; }
      tx += dx; ty += dy;
    }
  };

  const knightJumps = [{dx: 1, dy: 2}, {dx: 2, dy: 1}, {dx: 2, dy: -1}, {dx: 1, dy: -2}, {dx: -1, dy: -2}, {dx: -2, dy: -1}, {dx: -2, dy: 1}, {dx: -1, dy: 2}];
  const kingJumps = [{dx: 0, dy: 1}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: -1, dy: 0}, {dx: 1, dy: 1}, {dx: 1, dy: -1}, {dx: -1, dy: -1}, {dx: -1, dy: 1}];

  if (piece.type === 'Knight') addJumps(knightJumps);
  if (piece.type === 'Archbishop') { addJumps(knightJumps); addSlides(1,1); addSlides(1,-1); addSlides(-1,1); addSlides(-1,-1); }
  if (piece.type === 'Chancellor') { addJumps(knightJumps); addSlides(1,0); addSlides(-1,0); addSlides(0,1); addSlides(0,-1); }
  if (piece.team === 'player' && gameState.perks.includes('agile')) addJumps(kingJumps);

  return moves.filter((v,i,a) => a.findIndex(t => (t.x === v.x && t.y === v.y)) === i);
}

function handleCellClick(x, y) {
  if (gameState.turn === 'gameover' || gameState.turn === 'home' || gameState.turn !== 'player' || gameState.isDrafting) return;
  
  if (gameState.isPlacingTrap) {
    if (!gameState.pieces.some(p => p.x === x && p.y === y) && !gameState.voidSquares.some(v => v.x === x && v.y === y)) {
      gameState.voidSquares.push({x, y});
      gameState.trapsToPlace--;
      shakeScreen();
      if (gameState.trapsToPlace <= 0) {
        gameState.isPlacingTrap = false;
        gameState.trapUsedThisRound = true;
        log("Void set! Proceed with your move.");
        checkPlayerTrapped();
      } else {
        log(`Place ${gameState.trapsToPlace} more trap(s)...`);
      }
      render();
    }
    return;
  }

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

function triggerWaveClear() {
  let baseClear = 50;
  let efficiencyBonus = Math.max(0, 100 - (gameState.levelTurnCount * 5));
  addScore(baseClear + efficiencyBonus, true);
  
  log(`Wave Cleared! Turn Bonus: +${efficiencyBonus} pts`);
  gameState.level++;
  setTimeout(() => { (gameState.level === 3 || gameState.level === 6) ? triggerDraft('evolution') : triggerDraft('gambit'); }, 1200);
}

function triggerSuddenDeath() {
  const r = gameState.suddenDeathRing;
  const w = gameState.board.width;
  const h = gameState.board.height;
  let playerDied = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x <= r || x >= w - 1 - r || y <= r || y >= h - 1 - r) {
        if (!gameState.voidSquares.some(v => v.x === x && v.y === y)) {
          gameState.voidSquares.push({x, y});
          
          const pIdx = gameState.pieces.findIndex(p => p.x === x && p.y === y);
          if (pIdx !== -1) {
            const piece = gameState.pieces[pIdx];
            gameState.pieces.splice(pIdx, 1);
            if (piece.team === 'player') playerDied = true;
            else { log("An enemy fell into the Void!"); shakeScreen(); }
          }
        }
      }
    }
  }

  if (playerDied) {
    log("Swallowed by the Void. YOU DIED.");
    document.getElementById('board').classList.add('shake');
    gameState.turn = 'gameover';
  } else if (gameState.pieces.filter(p => p.team === 'enemy').length === 0) {
    triggerWaveClear();
  }
}

function checkPlayerTrapped() {
  if (gameState.turn === 'gameover') return;
  const player = gameState.pieces.find(p => p.team === 'player');
  if (player && getValidMoves(player).length === 0) {
    log("Trapped with no escape! YOU DIED.");
    document.getElementById('board').classList.add('shake');
    gameState.turn = 'gameover';
    render();
  }
}

function movePiece(id, tx, ty) {
  const piece = gameState.pieces.find(p => p.id === id);
  let killedEnemy = false, moveWasCapture = false;
  let multiKillCount = 0;
  
  if (piece.team === 'player') gameState.levelTurnCount++; 

  const tgtIdx = gameState.pieces.findIndex(p => p.x === tx && p.y === ty);
  if (tgtIdx !== -1) {
    const cap = gameState.pieces[tgtIdx];
    if (cap.team === 'player') { log("YOU DIED. Final Score: " + gameState.score); document.getElementById('board').classList.add('shake'); gameState.turn = 'gameover'; render(); return; }
    
    if (cap.isBoss && cap.hp > 1) {
      const originalBossX = cap.x, originalBossY = cap.y;
      piece.x = tx; piece.y = ty;
      cap.x = -1; cap.y = -1; 
      
      const playerThreats = getValidMoves(piece).map(m => `${m.x},${m.y}`);
      let validKnockbacks = [];
      
      [{dx:0,dy:1},{dx:1,dy:0},{dx:0,dy:-1},{dx:-1,dy:0},{dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1},{dx:1,dy:1}].forEach(d => {
          const nx = originalBossX + d.dx, ny = originalBossY + d.dy;
          if (nx >= 0 && nx < gameState.board.width && ny >= 0 && ny < gameState.board.height) {
              if (!gameState.pieces.some(p => p.x === nx && p.y === ny && p.id !== cap.id)) {
                  if (!gameState.voidSquares.some(v => v.x === nx && v.y === ny)) {
                      if (!playerThreats.includes(`${nx},${ny}`)) {
                          validKnockbacks.push({x: nx, y: ny});
                      }
                  }
              }
          }
      });
      
      if (validKnockbacks.length > 0) {
          const safeSpot = validKnockbacks[Math.floor(Math.random() * validKnockbacks.length)];
          cap.x = safeSpot.x; cap.y = safeSpot.y;
          cap.hp -= 1;
          log(`Direct Hit! Boss knocked to safety!`);
          moveWasCapture = true; 
          shakeScreen();
      } else {
          cap.x = originalBossX; cap.y = originalBossY; 
          gameState.pieces.splice(gameState.pieces.findIndex(p => p.id === cap.id), 1);
          killedEnemy = true; moveWasCapture = true; multiKillCount++;
          log(`CHECKMATE! The King falls! +100 Pts`);
          addScore(100, true);
          shakeScreen();
      }
    } else {
      gameState.pieces.splice(tgtIdx, 1);
      killedEnemy = true; moveWasCapture = true; multiKillCount++; shakeScreen();
      piece.x = tx; piece.y = ty;
    }
  } else {
    piece.x = tx; piece.y = ty;
  }

  if (piece.team === 'enemy' && piece.type === 'Pawn' && piece.y === gameState.board.height - 1) {
    piece.type = 'Queen'; log("A Pawn promoted to a Queen!"); shakeScreen();
  }

  if (piece.team === 'player') {
    if (moveWasCapture) gameState.turnsSinceCapture = 0;
    else gameState.turnsSinceCapture++;
  }

  if (piece.team === 'player') {
    const cleaveLvl = getPerkLevel('cleave');
    if (cleaveLvl >= 2 || (cleaveLvl === 1 && moveWasCapture)) {
      [{x: piece.x+1, y: piece.y}, {x: piece.x-1, y: piece.y}, {x: piece.x, y: piece.y+1}, {x: piece.x, y: piece.y-1}, 
       {x: piece.x+1, y: piece.y+1}, {x: piece.x-1, y: piece.y-1}, {x: piece.x+1, y: piece.y-1}, {x: piece.x-1, y: piece.y+1}].forEach(adj => {
        const idx = gameState.pieces.findIndex(p => p.team === 'enemy' && p.x === adj.x && p.y === adj.y && !p.isBoss);
        if (idx !== -1) { 
          gameState.pieces.splice(idx, 1); 
          killedEnemy = true; multiKillCount++; shakeScreen(); 
        }
      });
    }
    
    if (multiKillCount > 0) {
        addScore(10 * multiKillCount); 
        if (multiKillCount > 1) { addScore(20, true); log(`MULTI-KILL! +20 Pts`); }
    }
  }

  gameState.selectedPieceId = null; gameState.validMoves = []; render();
  
  if (gameState.turn === 'gameover') return;

  if (piece.team === 'player') {
    const enemies = gameState.pieces.filter(p => p.team === 'enemy');
    
    if (enemies.length === 0) {
      triggerWaveClear();
    } else {
      if (enemies.length === 1 && gameState.turnsSinceCapture >= 5) {
        if (!gameState.suddenDeathActive) {
            gameState.suddenDeathActive = true;
            gameState.suddenDeathTimer = 0;
            gameState.suddenDeathRing = 0;
            log("SUDDEN DEATH! The arena is collapsing!");
            triggerSuddenDeath();
            if (gameState.turn === 'gameover' || gameState.pieces.filter(p => p.team === 'enemy').length === 0) return;
        } else {
            gameState.suddenDeathTimer++;
            if (gameState.suddenDeathTimer >= 3) {
                gameState.suddenDeathTimer = 0;
                gameState.suddenDeathRing++;
                log("The void closes in...");
                triggerSuddenDeath();
                if (gameState.turn === 'gameover' || gameState.pieces.filter(p => p.team === 'enemy').length === 0) return;
            } else {
                log(`Void shrinks in ${3 - gameState.suddenDeathTimer} turn(s).`);
            }
        }
      }

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
        setTimeout(playEnemyTurn, 100); 
      }
    }
  } else {
    gameState.turn = 'player';
    checkPlayerTrapped();
  }
}

function playEnemyTurn() {
  if (gameState.turn === 'gameover') return;
  const enemies = gameState.pieces.filter(p => p.team === 'enemy');
  const player = gameState.pieces.find(p => p.team === 'player');
  if (!player || !enemies.length) return;

  const playerThreats = getValidMoves(player).map(m => `${m.x},${m.y}`);
  let allPossibleMoves = [];

  const addEnemySlides = (enemy, dx, dy) => {
    let tx = enemy.x + dx, ty = enemy.y + dy;
    while(tx >= 0 && tx < gameState.board.width && ty >= 0 && ty < gameState.board.height) {
      if (gameState.voidSquares.some(v => v.x === tx && v.y === ty)) break;
      if (tx === player.x && ty === player.y) { allPossibleMoves.push({ id: enemy.id, x: tx, y: ty, isLethal: true }); break; }
      if (gameState.pieces.some(p => p.x === tx && p.y === ty)) break; 
      allPossibleMoves.push({ id: enemy.id, x: tx, y: ty, isLethal: false });
      tx += dx; ty += dy;
    }
  };

  enemies.forEach(enemy => {
    if (enemy.type === 'Pawn') {
      const fy = enemy.y + 1;
      if (fy < gameState.board.height && !gameState.voidSquares.some(v => v.x === enemy.x && v.y === fy)) {
        if (!gameState.pieces.some(p => p.x === enemy.x && p.y === fy)) allPossibleMoves.push({ id: enemy.id, x: enemy.x, y: fy, isLethal: false }); 
        if (player.y === fy && (player.x === enemy.x - 1 || player.x === enemy.x + 1)) allPossibleMoves.push({ id: enemy.id, x: player.x, y: fy, isLethal: true }); 
      }
    } else if (enemy.type === 'Queen') {
      [{dx: 0,dy: 1},{dx: 1,dy: 0},{dx: 0,dy: -1},{dx: -1,dy: 0},{dx: 1,dy: 1},{dx: 1,dy: -1},{dx: -1,dy: -1},{dx: -1,dy: 1}].forEach(d => addEnemySlides(enemy, d.dx, d.dy));
    } else if (enemy.type === 'Rook') {
      [{dx: 0,dy: 1},{dx: 1,dy: 0},{dx: 0,dy: -1},{dx: -1,dy: 0}].forEach(d => addEnemySlides(enemy, d.dx, d.dy));
    } else if (enemy.type === 'Bishop') {
      [{dx: 1,dy: 1},{dx: 1,dy: -1},{dx: -1,dy: -1},{dx: -1,dy: 1}].forEach(d => addEnemySlides(enemy, d.dx, d.dy));
    } else if (enemy.type === 'King') {
      [{dx: 0,dy: 1},{dx: 1,dy: 0},{dx: 0,dy: -1},{dx: -1,dy: 0},{dx: 1,dy: 1},{dx: 1,dy: -1},{dx: -1,dy: -1},{dx: -1,dy: 1}].forEach(d => {
        const nx = enemy.x + d.dx, ny = enemy.y + d.dy;
        if (nx >= 0 && nx < gameState.board.width && ny >= 0 && ny < gameState.board.height && !gameState.voidSquares.some(v => v.x === nx && v.y === ny)) {
          if (nx === player.x && ny === player.y) allPossibleMoves.push({ id: enemy.id, x: nx, y: ny, isLethal: true });
          else if (!gameState.pieces.some(p => p.x === nx && p.y === ny)) allPossibleMoves.push({ id: enemy.id, x: nx, y: ny, isLethal: false });
        }
      });
    }
  });

  if (allPossibleMoves.length > 0) {
    const lethalMove = allPossibleMoves.find(m => m.isLethal);
    if (lethalMove) { movePiece(lethalMove.id, lethalMove.x, lethalMove.y); return; }

    let bestMove = null, highestScore = -Infinity;
    
    const isStalling = (enemies.length === 1 && gameState.turnsSinceCapture >= 3);
    const nextDangerRing = gameState.suddenDeathActive ? gameState.suddenDeathRing + (gameState.suddenDeathTimer >= 2 ? 1 : 0) : 0;

    allPossibleMoves.forEach(move => {
      let score = 0;
      const currentlyThreatened = playerThreats.includes(`${gameState.pieces.find(p=>p.id===move.id).x},${gameState.pieces.find(p=>p.id===move.id).y}`);
      const moveIsSafe = !playerThreats.includes(`${move.x},${move.y}`);
      
      if (currentlyThreatened && moveIsSafe) score += 50; 
      if (!currentlyThreatened && !moveIsSafe) score -= 100; 
      score -= (Math.abs(player.x - move.x) + Math.abs(player.y - move.y)); 

      if (isStalling || gameState.suddenDeathActive) {
        const moveRing = Math.min(move.x, move.y, gameState.board.width - 1 - move.x, gameState.board.height - 1 - move.y);
        
        if (moveRing <= nextDangerRing) {
          score -= 500; 
        } else {
          score += (moveRing * 20); 
        }
      }

      if (score > highestScore) { highestScore = score; bestMove = move; }
      else if (score === highestScore && Math.random() > 0.5) { bestMove = move; } 
    });

    if (bestMove) { movePiece(bestMove.id, bestMove.x, bestMove.y); return; }
  }
  
  gameState.turn = 'player'; 
  gameState.momentumUsed = 0; 
  gameState.bloodlustUsed = 0; 
  checkPlayerTrapped();
}

function render() {
  const b = document.getElementById('board');
  b.innerHTML = '';
  
  b.style.gridTemplateColumns = `repeat(${gameState.board.width}, 1fr)`;
  b.style.gridTemplateRows = `repeat(${gameState.board.height}, 1fr)`;

  for (let y = 0; y < gameState.board.height; y++) {
    for (let x = 0; x < gameState.board.width; x++) {
      const cell = document.createElement('div');
      cell.className = `cell ${(x+y)%2===0 ? 'light' : 'dark'}`;
      if (gameState.validMoves.some(m => m.x === x && m.y === y)) cell.classList.add('valid-move');
      if (gameState.voidSquares.some(v => v.x === x && v.y === y)) cell.classList.add('void');
      
      const piece = gameState.pieces.find(p => p.x === x && p.y === y);
      if (piece) {
        const pEl = document.createElement('div');
        pEl.className = `piece ${piece.team}`;
        if (piece.isBoss) pEl.classList.add('boss');
        
        let htmlContent = symbols[piece.type];
        if (piece.hp && piece.hp > 0) {
          const superscripts = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
          htmlContent += `<span class="hp-indicator">${superscripts[piece.hp] || `^${piece.hp}`}</span>`;
        }
        
        pEl.innerHTML = htmlContent;
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
      const titleSuffix = p.maxLevel > 1 ? `<br><span style="color:#ffd700; font-size: 0.85em;">(Lv ${lvl})</span>` : '';
      
      if (perkId === 'trap') {
        const isUsed = gameState.trapUsedThisRound;
        const actionText = isUsed ? '(Used)' : '(Tap to Use)';
        const interactClass = isUsed ? 'used-perk' : 'clickable-perk';
        tray.innerHTML += `
          <div class="active-perk-card ${interactClass}" ${!isUsed ? 'onclick="activateTrap()"' : ''}>
            <h4>${p.icon} ${p.title}${titleSuffix}</h4>
            <p>${p.getDesc(lvl)}<br><b style="color: ${isUsed ? '#888' : '#e94560'}; margin-top: 2px; display: block;">${actionText}</b></p>
          </div>`;
      } else {
        tray.innerHTML += `<div class="active-perk-card"><h4>${p.icon} ${p.title}${titleSuffix}</h4><p>${p.getDesc(lvl)}</p></div>`;
      }
    }
  });
}

function shakeScreen() {
  const b = document.getElementById('board');
  b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
}

function log(msg) { document.getElementById('message-log').textContent = msg; }

// --- EVENT LISTENERS ---
document.getElementById('reset-btn').addEventListener('click', initGame);
document.getElementById('start-game-btn').addEventListener('click', initGame);

const modal = document.getElementById('help-modal');
document.getElementById('help-btn').addEventListener('click', () => modal.style.display = 'flex');
document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); 
  deferredPrompt = e; 
  document.getElementById('install-btn').style.display = 'block';
  document.getElementById('home-install-btn').style.display = 'block'; // Triggers the big start-screen button
});

const handleInstallClick = async () => {
  if (deferredPrompt) { 
    deferredPrompt.prompt(); 
    const { outcome } = await deferredPrompt.userChoice; 
    if (outcome === 'accepted') {
      document.getElementById('install-btn').style.display = 'none'; 
      document.getElementById('home-install-btn').style.display = 'none'; 
    }
    deferredPrompt = null; 
  }
};
document.getElementById('install-btn').addEventListener('click', handleInstallClick);
document.getElementById('home-install-btn').addEventListener('click', handleInstallClick);

updateHUD(); bootApp();