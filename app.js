// --- 1. Core State ---
let gameState = {
  level: 1,
  board: { width: 5, height: 5 },
  pieces: [],
  selectedPieceId: null,
  validMoves: [],
  turn: 'player' 
};

const pieceSymbols = { Knight: '♞', Pawn: '♟', King: '♚' };

// --- 2. Initialization & Progression ---
function initLevel() {
  gameState.turn = 'player';
  gameState.selectedPieceId = null;
  gameState.validMoves = [];
  
  if (gameState.level === 3) gameState.board = { width: 6, height: 6 };
  if (gameState.level === 5) gameState.board = { width: 7, height: 7 };

  const playerStartX = Math.floor(gameState.board.width / 2);
  const playerStartY = gameState.board.height - 1;

  gameState.pieces = [
    { id: 'player', type: 'Knight', team: 'player', x: playerStartX, y: playerStartY }
  ];

  const enemyCount = gameState.level + 1; 
  for (let i = 0; i < enemyCount; i++) {
    let ex = Math.floor(Math.random() * gameState.board.width);
    let ey = Math.floor(Math.random() * Math.floor(gameState.board.height / 2));
    
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
  if (gameState.turn !== 'player') return;

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
  
  const targetIndex = gameState.pieces.findIndex(p => p.x === targetX && p.y === targetY);
  if (targetIndex !== -1) {
    const capturedPiece = gameState.pieces[targetIndex];
    gameState.pieces.splice(targetIndex, 1);
    
    if (capturedPiece.team === 'player') {
        document.getElementById('message-log').innerHTML = `<span class="game-over-text">GAME OVER! Your Knight was captured.</span>`;
        render();
        return; 
    }
  }

  piece.x = targetX;
  piece.y = targetY;

  gameState.selectedPieceId = null;
  gameState.validMoves = [];
  render();

  if (piece.team === 'player') {
    const enemiesLeft = gameState.pieces.filter(p => p.team === 'enemy').length;
    if (enemiesLeft === 0) {
        logMessage(`Level ${gameState.level} Cleared! Preparing next wave...`);
        gameState.level++;
        setTimeout(initLevel, 1500);
    } else {
        gameState.turn = 'enemy';
        setTimeout(playEnemyTurn, 400); 
    }
  } else {
    gameState.turn = 'player';
  }
}

// --- 4. STRICT CHESS AI (Pawns act like Pawns) ---
function playEnemyTurn() {
    const enemies = gameState.pieces.filter(p => p.team === 'enemy');
    const player = gameState.pieces.find(p => p.team === 'player');
    
    if (!player || enemies.length === 0) return;

    let possibleMoves = [];

    // Evaluate valid chess moves for every enemy on the board
    enemies.forEach(enemy => {
        if (enemy.type === 'Pawn') {
            // Enemy Pawns move DOWN the board (y + 1)
            const forwardY = enemy.y + 1;
            
            // If they reach the bottom of the board, they get stuck
            if (forwardY >= gameState.board.height) return;

            // 1. Check for diagonal captures against the player
            const canCaptureLeft = (player.x === enemy.x - 1 && player.y === forwardY);
            const canCaptureRight = (player.x === enemy.x + 1 && player.y === forwardY);
            
            // 2. Check straight forward movement (square must be empty)
            const isForwardEmpty = !gameState.pieces.some(p => p.x === enemy.x && p.y === forwardY);

            if (canCaptureLeft) possibleMoves.push({ id: enemy.id, x: enemy.x - 1, y: forwardY, isCapture: true });
            if (canCaptureRight) possibleMoves.push({ id: enemy.id, x: enemy.x + 1, y: forwardY, isCapture: true });
            
            // Only add forward movement if they don't have a capture available
            if (isForwardEmpty) possibleMoves.push({ id: enemy.id, x: enemy.x, y: forwardY, isCapture: false });
        }
    });

    if (possibleMoves.length > 0) {
        // AI Logic: ALWAYS prioritize capturing the player if possible
        const captures = possibleMoves.filter(m => m.isCapture);
        const movePool = captures.length > 0 ? captures : possibleMoves;

        // Pick a random valid move from the pool
        const chosenMove = movePool[Math.floor(Math.random() * movePool.length)];
        movePiece(chosenMove.id, chosenMove.x, chosenMove.y);
    } else {
        // If all enemies are blocked or stuck, skip turn
        gameState.turn = 'player'; 
    }
}

// --- 5. Rendering ---
function render() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${gameState.board.width}, 60px)`;
  boardEl.style.gridTemplateRows = `repeat(${gameState.board.height}, 60px)`;

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