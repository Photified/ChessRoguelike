// --- 1. Core State ---
let gameState = {
  board: { width: 5, height: 5 },
  pieces: [],
  selectedPieceId: null,
  validMoves: []
};

// Unicode placeholders for pieces to keep it lightweight
const pieceSymbols = {
  Knight: '♞',
  Pawn: '♟',
  King: '♚'
};

// --- 2. Initialization ---
function initGame() {
  gameState.board = { width: 5, height: 5 };
  gameState.pieces = [
    { id: 'p1', type: 'Knight', team: 'player', x: 2, y: 4 },
    { id: 'e1', type: 'Pawn', team: 'enemy', x: 1, y: 1 },
    { id: 'e2', type: 'Pawn', team: 'enemy', x: 3, y: 1 }
  ];
  gameState.selectedPieceId = null;
  gameState.validMoves = [];
  logMessage("Game started. Tap your Knight to move.");
  render();
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

      // Stay on the dynamic board
      if (tx >= 0 && tx < gameState.board.width && ty >= 0 && ty < gameState.board.height) {
        // Prevent landing on your own team
        const pieceAtTarget = gameState.pieces.find(p => p.x === tx && p.y === ty);
        if (!pieceAtTarget || pieceAtTarget.team !== piece.team) {
          moves.push({ x: tx, y: ty });
        }
      }
    });
  }
  return moves;
}

function handleCellClick(x, y) {
  const clickedPiece = gameState.pieces.find(p => p.x === x && p.y === y);

  // If we already have a piece selected, check if we clicked a valid move square
  if (gameState.selectedPieceId) {
    const isMoveValid = gameState.validMoves.some(m => m.x === x && m.y === y);
    
    if (isMoveValid) {
      movePiece(gameState.selectedPieceId, x, y);
      return;
    }
  }

  // Otherwise, select a player piece
  if (clickedPiece && clickedPiece.team === 'player') {
    gameState.selectedPieceId = clickedPiece.id;
    gameState.validMoves = getValidMoves(clickedPiece);
    render();
  } else {
    // Clicked empty space or enemy without valid move, deselect
    gameState.selectedPieceId = null;
    gameState.validMoves = [];
    render();
  }
}

function movePiece(pieceId, targetX, targetY) {
  // Handle captures
  const enemyIndex = gameState.pieces.findIndex(p => p.x === targetX && p.y === targetY && p.team === 'enemy');
  if (enemyIndex !== -1) {
    logMessage(`Captured enemy ${gameState.pieces[enemyIndex].type}!`);
    gameState.pieces.splice(enemyIndex, 1);
  }

  // Update piece location
  const piece = gameState.pieces.find(p => p.id === pieceId);
  piece.x = targetX;
  piece.y = targetY;

  // Clear selection
  gameState.selectedPieceId = null;
  gameState.validMoves = [];
  
  logMessage(`Knight moved to (${targetX}, ${targetY}).`);
  render();
}

// --- 4. Rendering ---
function render() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  
  // Set dynamic grid dimensions
  boardEl.style.gridTemplateColumns = `repeat(${gameState.board.width}, 50px)`;
  boardEl.style.gridTemplateRows = `repeat(${gameState.board.height}, 50px)`;

  for (let y = 0; y < gameState.board.height; y++) {
    for (let x = 0; x < gameState.board.width; x++) {
      const cell = document.createElement('div');
      
      // Checkerboard math
      const isLight = (x + y) % 2 === 0;
      cell.className = `cell ${isLight ? 'light' : 'dark'}`;
      
      // Highlight valid moves
      if (gameState.validMoves.some(m => m.x === x && m.y === y)) {
        cell.classList.add('valid-move');
      }

      // Render pieces
      const piece = gameState.pieces.find(p => p.x === x && p.y === y);
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = `piece ${piece.team}`;
        pieceEl.textContent = pieceSymbols[piece.type];
        
        // Visual indicator for selected piece
        if (piece.id === gameState.selectedPieceId) {
          pieceEl.style.transform = 'scale(1.2)';
        }
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

// --- 5. Controls ---
document.getElementById('reset-btn').addEventListener('click', initGame);

document.getElementById('expand-btn').addEventListener('click', () => {
  gameState.board.width += 1;
  gameState.board.height += 1;
  gameState.selectedPieceId = null;
  gameState.validMoves = [];
  logMessage("Boss Defeated! Board expanded.");
  render();
});

// Boot the game
initGame();