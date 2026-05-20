// --- 1. Core State ---
let gameState = {
  level: 1,
  board: { width: 5, height: 5 },
  pieces: [],
  selectedPieceId: null,
  validMoves: [],
  turn: 'player' // Tracks whose turn it is
};

const pieceSymbols = { Knight: '♞', Pawn: '♟', King: '♚' };

// --- 2. Initialization & Progression ---
function initLevel() {
  gameState.turn = 'player';
  gameState.selectedPieceId = null;
  gameState.validMoves = [];
  
  // As levels go up, the board can grow!
  if (gameState.level === 3) gameState.board = { width: 6, height: 6 };
  if (gameState.level === 5) gameState.board = { width: 7, height: 7 };

  // Spawn Player at the bottom center
  const playerStartX = Math.floor(gameState.board.width / 2);
  const playerStartY = gameState.board.height - 1;

  gameState.pieces = [
    { id: 'player', type: 'Knight', team: 'player', x: playerStartX, y: playerStartY }
  ];

  // Procedurally spawn enemies based on the level
  const enemyCount = gameState.level + 1; // Level 1 = 2 enemies, Level 2 = 3 enemies, etc.
  for (let i = 0; i < enemyCount; i++) {
    // Randomize enemy positions in the top half of the board
    let ex = Math.floor(Math.random() * gameState.board.width);
    let ey = Math.floor(Math.random() * Math.floor(gameState.board.height / 2));
    
    // Make sure we don't spawn two enemies on the same square
    while (gameState.pieces.some(p => p.x === ex && p.y === ey)) {
        ex = Math.floor(Math.random() * gameState.board.width);
        ey = Math.floor(Math.random() * Math.floor(gameState.board.height / 2));
    }
    
    gameState.pieces.push({ id: `e${i}`, type: 'Pawn', team: 'enemy', x: ex, y: ey });
  }

  logMessage(`Level ${gameState.level} starts! Tap your Knight.`);
  render();
}

function initGame() {
    gameState.level = 1;
    gameState.board = { width: 5, height: 5 };
    initLevel();
}

// --- 3. Logic & Movement ---
function getValidMoves(piece) {
  const moves = [];
  if (piece.type === 'Knight') {
    const jumps = [
      { dx: 1, dy: 2 }, { dx: 2, dy: 1 }, { dx: 2, dy: -1 }, { dx: 1, dy: -2 },
      { dx: -1, dy: -2 }, { dx: -2, dy: -1 }, { dx: -2, dy: 1 }, { dx: -1, dy: 2 }
    ];
    jumps.forEach(jump => {
      const tx = piece.x + jump.dx;
      const ty = piece.y + jump.dy;
      if (tx >= 0 && tx < gameState.board.width && ty >= 0 && ty < gameState.board.height) {
        const pieceAtTarget = gameState.pieces.find(p => p.x === tx && p.y === ty);
        if (!pieceAtTarget || pieceAtTarget.team !== piece.team) moves.push({ x: tx, y: ty });
      }
    });
  }
  return moves;
}

function handleCellClick(x, y) {
  if (gameState.turn !== 'player') return; // Ignore clicks if it's not the player's turn

  const clickedPiece = gameState.pieces.find(p => p.x === x && p.y === y);

  if (gameState.selectedPieceId) {
    const isMoveValid = gameState.validMoves.some(m => m.x === x && m.y === y);
    if (isMoveValid) {
      movePiece(gameState.selectedPieceId, x, y);
      return;
    }
  }

  if (clickedPiece && clickedPiece.team === 'player') {
    gameState.selectedPieceId = clickedPiece.id;
    gameState.validMoves = getValidMoves(clickedPiece);
    render();
  } else {
    gameState.selectedPieceId = null;
    gameState.validMoves = [];
    render();
  }
}

function movePiece(pieceId, targetX, targetY) {
  const piece = gameState.pieces.find(p => p.id === pieceId);
  
  // Handle captures
  const targetIndex = gameState.pieces.findIndex(p => p.x === targetX && p.y === targetY);
  if (targetIndex !== -1) {
    const capturedPiece = gameState.pieces[targetIndex];
    gameState.pieces.splice(targetIndex, 1);
    
    if (capturedPiece.team === 'player') {
        logMessage("GAME OVER! Your Knight was captured.");
        render();
        return; // Halt the game loop
    }
  }

  // Update location
  piece.x = targetX;
  piece.y = targetY;

  // Clear selection
  gameState.selectedPieceId = null;
  gameState.validMoves = [];
  render();

  // Check Game State Progression
  if (piece.team === 'player') {
    const enemiesLeft = gameState.pieces.filter(p => p.team === 'enemy').length;
    if (enemiesLeft === 0) {
        logMessage(`Level ${gameState.level} Cleared! Preparing next wave...`);
        gameState.level++;
        setTimeout(initLevel, 1500);
    } else {
        // Pass turn to enemies
        gameState.turn = 'enemy';
        setTimeout(playEnemyTurn, 500); // 500ms delay so it feels like the computer is "thinking"
    }
  } else {
    // Enemy finished moving, pass back to player
    gameState.turn = 'player';
  }
}

// --- 4. Enemy AI ---
function playEnemyTurn() {
    const enemies = gameState.pieces.filter(p => p.team === 'enemy');
    const player = gameState.pieces.find(p => p.team === 'player');
    
    if (!player || enemies.length === 0) return;

    // Super simple AI: Randomly pick one enemy to move 1 square towards the player
    const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
    
    let moveX = randomEnemy.x;
    let moveY = randomEnemy.y;

    if (randomEnemy.x < player.x) moveX++;
    else if (randomEnemy.x > player.x) moveX--;
    else if (randomEnemy.y < player.y) moveY++;
    else if (randomEnemy.y > player.y) moveY--;

    // Make sure they don't step on another enemy
    const isOccupied = gameState.pieces.some(p => p.team === 'enemy' && p.x === moveX && p.y === moveY);
    
    if (!isOccupied) {
        movePiece(randomEnemy.id, moveX, moveY);
    } else {
        // If blocked, just skip turn
        gameState.turn = 'player'; 
    }
}

// --- 5. Rendering ---
function render() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${gameState.board.width}, 50px)`;
  boardEl.style.gridTemplateRows = `repeat(${gameState.board.height}, 50px)`;

  for (let y = 0; y < gameState.board.height; y++) {
    for (let x = 0; x < gameState.board.width; x++) {
      const cell = document.createElement('div');
      const isLight = (x + y) % 2 === 0;
      cell.className = `cell ${isLight ? 'light' : 'dark'}`;
      
      if (gameState.validMoves.some(m => m.x === x && m.y === y)) {
        cell.classList.add('valid-move');
      }

      const piece = gameState.pieces.find(p => p.x === x && p.y === y);
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = `piece ${piece.team}`;
        pieceEl.textContent = pieceSymbols[piece.type];
        if (piece.id === gameState.selectedPieceId) pieceEl.style.transform = 'scale(1.2)';
        cell.appendChild(pieceEl);
      }

      cell.addEventListener('click', () => handleCellClick(x, y));
      boardEl.appendChild(cell);
    }
  }
}

function logMessage(msg) {
  document.getElementById('message-log').textContent = msg;
}

// --- 6. Controls ---
document.getElementById('reset-btn').addEventListener('click', initGame);

// Boot the game
initGame();