// script.js

// --- Game Constants & State ---
const BOARD_SIZE = 8;
const PIECE_THEME_URL = 'https://upload.wikimedia.org/wikipedia/commons/';
const PIECES_SVG = {
    'p': 'c/c7/Chess_pdt45.svg', 'n': 'e/ef/Chess_ndt45.svg', 'b': '9/98/Chess_bdt45.svg',
    'r': 'f/ff/Chess_rdt45.svg', 'q': '4/47/Chess_qdt45.svg', 'k': 'f/f0/Chess_kdt45.svg',
    'P': '4/45/Chess_plt45.svg', 'N': '7/70/Chess_nlt45.svg', 'B': 'b/b1/Chess_blt45.svg',
    'R': '7/72/Chess_rlt45.svg', 'Q': '1/15/Chess_qlt45.svg', 'K': '4/42/Chess_klt45.svg'
};

const PIECE_VALUES = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 4,
    'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 4
};

const INITIAL_BOARD = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let board = [];
let turn = 'w';
let selectedSquare = null;
let isAnimating = false;

let whiteScore = 0;
let blackScore = 0;
let isComputerOpponent = true;

// Tournament State
let playerWins = 0;
let computerWins = 0;

// --- Initialization ---
function initGame() {
    resetBoard();
    renderBoard();
    updateStatus();
    updateTournamentDisplay();

    document.getElementById('restart-btn').addEventListener('click', () => {
        resetBoard();
        renderBoard();
        updateStatus();
        closeModal();
    });

    // Reset Tournament Logic
    const resetTourneyBtn = document.getElementById('reset-tournament-btn');
    if (resetTourneyBtn) {
        resetTourneyBtn.addEventListener('click', () => {
            playerWins = 0;
            computerWins = 0;
            updateTournamentDisplay();
        });
    }

    // Modal New Game Button
    const modalNewGameBtn = document.getElementById('new-game-btn');
    if (modalNewGameBtn) {
        modalNewGameBtn.addEventListener('click', () => {
            resetBoard();
            renderBoard();
            updateStatus();
            closeModal();
        });
    }
}

function resetBoard() {
    board = INITIAL_BOARD.map(row => [...row]);
    turn = 'w';
    selectedSquare = null;
    isAnimating = false;
    whiteScore = 0;
    blackScore = 0;
    closeModal();
}

// --- Core Logic ---

function getPiece(row, col) {
    if (row < 0 || row >= 8 || col < 0 || col >= 8) return undefined;
    return board[row][col];
}

function isWhite(piece) { return piece === piece.toUpperCase(); }
function isBlack(piece) { return piece === piece.toLowerCase(); }
function getPieceColor(piece) {
    if (!piece) return null;
    return isWhite(piece) ? 'w' : 'b';
}

function isValidMove(fromR, fromC, toR, toC) {
    const piece = board[fromR][fromC];
    if (!piece) return false;

    if (fromR === toR && fromC === toC) return false;

    const target = board[toR][toC];
    if (target && getPieceColor(target) === getPieceColor(piece)) return false;

    const dx = toC - fromC;
    const dy = toR - fromR;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const type = piece.toLowerCase();

    switch (type) {
        case 'p':
            const direction = isWhite(piece) ? -1 : 1;
            const startRow = isWhite(piece) ? 6 : 1;
            if (dx === 0 && dy === direction && !target) return true;
            if (dx === 0 && dy === 2 * direction && fromR === startRow && !target && !board[fromR + direction][fromC]) return true;
            if (Math.abs(dx) === 1 && dy === direction && target) return true;
            return false;
        case 'r': if (dx !== 0 && dy !== 0) return false; return isPathClear(fromR, fromC, toR, toC);
        case 'b': if (adx !== ady) return false; return isPathClear(fromR, fromC, toR, toC);
        case 'q': if (dx !== 0 && dy !== 0 && adx !== ady) return false; return isPathClear(fromR, fromC, toR, toC);
        case 'n': return (adx === 2 && ady === 1) || (adx === 1 && ady === 2);
        case 'k': return adx <= 1 && ady <= 1;
    }
    return false;
}

function isPathClear(r1, c1, r2, c2) {
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    let r = r1 + dr;
    let c = c1 + dc;
    while (r !== r2 || c !== c2) {
        if (board[r][c]) return false;
        r += dr;
        c += dc;
    }
    return true;
}

// --- Move Execution & AI ---

async function executeMove(fromR, fromC, toR, toC) {
    if (isAnimating) return;
    isAnimating = true;

    const movedPiece = board[fromR][fromC];
    const targetPiece = board[toR][toC];

    // 1. Standard Capture -> Update Score
    if (targetPiece) {
        eliminatePiece(toR, toC);
    }

    // 2. Perform Move
    board[toR][toC] = movedPiece;
    board[fromR][fromC] = null;

    // 3. Promotion
    if (movedPiece === 'P' && toR === 0) board[toR][toC] = 'Q';
    if (movedPiece === 'p' && toR === 7) board[toR][toC] = 'q';

    // 4. Update UI (Initial)
    selectedSquare = null;
    renderBoard();
    updateStatus();

    // 5. Switch Turn Logic
    turn = turn === 'w' ? 'b' : 'w';

    // 6. Resolve Threats (Async Animation) -- Waits here
    await resolveThreatsAndEliminate(movedPiece, toR, toC);

    // 7. Check Game Over in handleThreats, if not over, continue to AI
    // We check gameOver flag? checkWinCondition handles modals.
    // If modal is visible, we stop.
    if (document.querySelector('.modal').classList.contains('hidden')) {
        // 8. Trigger AI if needed
        if (isComputerOpponent && turn === 'b') {
            setTimeout(makeComputerMove, 500);
        }
    }
}

async function resolveThreatsAndEliminate(movedPiece, r, c) {
    const threats = findThreats(movedPiece, r, c);

    if (threats.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 300));
        threats.forEach(t => {
            const squareEl = document.querySelector(`.square[data-row="${t.r}"][data-col="${t.c}"]`);
            if (squareEl) squareEl.classList.add('threat-target');
        });

        await new Promise(resolve => setTimeout(resolve, 800));
        threats.forEach(t => eliminatePiece(t.r, t.c));
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    isAnimating = false;
    renderBoard();
    updateStatus();
    checkWinCondition();
    checkDrawCondition();
}

function makeComputerMove() {
    if (turn !== 'b') return;

    const moves = getAllValidMoves('b');
    if (moves.length === 0) return;

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of moves) {
        const score = evaluateMove(move);
        const random = Math.random() * 0.5;
        if (score + random > bestScore) {
            bestScore = score + random;
            bestMove = move;
        }
    }

    if (bestMove) {
        isAnimating = false; // Bypass lock for internal call (though it should be free already)
        executeMove(bestMove.fromR, bestMove.fromC, bestMove.toR, bestMove.toC);
    }
}

function getAllValidMoves(color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && getPieceColor(piece) === color) {
                for (let tr = 0; tr < 8; tr++) {
                    for (let tc = 0; tc < 8; tc++) {
                        if (isValidMove(r, c, tr, tc)) {
                            moves.push({ fromR: r, fromC: c, toR: tr, toC: tc });
                        }
                    }
                }
            }
        }
    }
    return moves;
}

function evaluateMove(move) {
    let score = 0;
    const target = board[move.toR][move.toC];
    if (target) score += (PIECE_VALUES[target] || 0) * 10;

    const movedPiece = board[move.fromR][move.fromC];
    const originalTarget = board[move.toR][move.toC];

    board[move.toR][move.toC] = movedPiece;
    board[move.fromR][move.fromC] = null;

    const threats = findThreats(movedPiece, move.toR, move.toC);
    threats.forEach(t => {
        const victim = board[t.r][t.c];
        if (victim) score += (PIECE_VALUES[victim] || 0) * 15;
    });

    board[move.fromR][move.fromC] = movedPiece;
    board[move.toR][move.toC] = originalTarget;

    if (movedPiece === 'p') score += 1;
    if (['n', 'b'].includes(movedPiece)) score += 0.5;

    return score;
}

function findThreats(movedPiece, r, c) {
    const type = movedPiece.toLowerCase();
    const myColor = getPieceColor(movedPiece);
    const threats = [];

    const directions = [];
    if (type === 'r' || type === 'q') directions.push([0, 1], [0, -1], [1, 0], [-1, 0]);
    if (type === 'b' || type === 'q') directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);

    if (directions.length > 0) {
        for (const [dr, dc] of directions) {
            let currR = r + dr;
            let currC = c + dc;
            while (currR >= 0 && currR < 8 && currC >= 0 && currC < 8) {
                const target = board[currR][currC];
                if (target) {
                    if (getPieceColor(target) !== myColor) {
                        threats.push({ r: currR, c: currC });
                    }
                    break;
                }
                currR += dr;
                currC += dc;
            }
        }
    }

    if (type === 'n') {
        const jumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const [dr, dc] of jumps) checkThreat(r + dr, c + dc, myColor, threats);
    }
    if (type === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr !== 0 || dc !== 0) checkThreat(r + dr, c + dc, myColor, threats);
            }
        }
    }

    if (type === 'p') {
        const dir = isWhite(movedPiece) ? -1 : 1;
        checkThreat(r + dir, c - 1, myColor, threats);
        checkThreat(r + dir, c + 1, myColor, threats);
    }

    return threats;
}

function checkThreat(r, c, myColor, threats) {
    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const target = board[r][c];
        if (target && getPieceColor(target) !== myColor) {
            threats.push({ r, c });
        }
    }
}

function eliminatePiece(r, c) {
    const piece = board[r][c];
    if (!piece) return;

    const val = PIECE_VALUES[piece] || 0;
    if (isWhite(piece)) blackScore += val;
    else whiteScore += val;

    board[r][c] = null;

    const color = getPieceColor(piece);
    const killerColor = color === 'w' ? 'b' : 'w';
    const containerId = killerColor === 'w' ? 'captured-by-white' : 'captured-by-black';
    const container = document.getElementById(containerId);

    if (container) {
        const img = document.createElement('img');
        img.src = PIECE_THEME_URL + PIECES_SVG[piece];
        img.className = 'captured-icon';
        container.appendChild(img);
    }
}

function checkWinCondition() {
    const whiteCount = board.flat().filter(p => p && isWhite(p)).length;
    const blackCount = board.flat().filter(p => p && isBlack(p)).length;

    if (whiteCount === 0) endGame('black');
    else if (blackCount === 0) endGame('white');
}

function checkDrawCondition() {
    // Collect all pieces
    const pieces = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c]) {
                pieces.push({ p: board[r][c], r, c });
            }
        }
    }

    if (pieces.length === 2) {
        const p1 = pieces[0];
        const p2 = pieces[1];
        // Check if one is 'B' and one is 'b'
        // And they are on different color squares
        const type1 = p1.p.toLowerCase();
        const type2 = p2.p.toLowerCase();

        if (type1 === 'b' && type2 === 'b' && getPieceColor(p1.p) !== getPieceColor(p2.p)) {
            // Check square colors: (r+c)%2
            const color1 = (p1.r + p1.c) % 2;
            const color2 = (p2.r + p2.c) % 2;

            if (color1 !== color2) {
                endGame('draw');
            }
        }
    }
}

function endGame(winner) {
    // winner: 'white', 'black', 'draw'
    isAnimating = true; // Stop play

    const modal = document.getElementById('victory-modal');
    const title = document.getElementById('victory-title');
    const msg = document.getElementById('victory-message');

    modal.classList.remove('hidden');

    if (winner === 'draw') {
        title.textContent = "תיקו!";
        msg.textContent = "נשארו רצים על משבצות בצבע שונה.";
    } else {
        title.textContent = "ניצחון!";
        if (winner === 'white') {
            msg.textContent = "ניצחון ללבן! (השחקן)";
            playerWins++;
        } else {
            msg.textContent = "ניצחון לשחור! (המחשב)";
            computerWins++;
        }
        updateTournamentDisplay();
    }
}

function closeModal() {
    document.getElementById('victory-modal').classList.add('hidden');
}

// --- Interaction ---

async function onSquareClick(r, c) {
    if (isAnimating) return;
    if (isComputerOpponent && turn === 'b') return;

    const piece = board[r][c];

    if (piece && getPieceColor(piece) === turn) {
        selectedSquare = { r, c };
        renderBoard();
        return;
    }

    if (selectedSquare) {
        if (isValidMove(selectedSquare.r, selectedSquare.c, r, c)) {
            executeMove(selectedSquare.r, selectedSquare.c, r, c);
        } else {
            selectedSquare = null;
            renderBoard();
        }
    }
}

function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const squareEl = document.createElement('div');
            const isLight = (r + c) % 2 === 0;
            squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
            squareEl.dataset.row = r;
            squareEl.dataset.col = c;

            const piece = board[r][c];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = 'piece';
                pieceEl.style.backgroundImage = `url('${PIECE_THEME_URL + PIECES_SVG[piece]}')`;
                squareEl.appendChild(pieceEl);
            }

            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                squareEl.classList.add('highlight');
            }
            if (selectedSquare && !isAnimating && isValidMove(selectedSquare.r, selectedSquare.c, r, c)) {
                squareEl.classList.add('valid-move');
            }

            squareEl.onclick = () => onSquareClick(r, c);
            boardEl.appendChild(squareEl);
        }
    }
}

function updateStatus() {
    const turnBadge = document.getElementById('turn-indicator');
    const statusEl = document.getElementById('status-message');

    const whiteEl = document.getElementById('score-white');
    const blackEl = document.getElementById('score-black');
    if (whiteEl) whiteEl.textContent = whiteScore;
    if (blackEl) blackEl.textContent = blackScore;

    // We only update status if game NOT over
    // But now endGame handles over state with modal.
    if (!document.querySelector('.modal').classList.contains('hidden')) return;

    turnBadge.textContent = turn === 'w' ? 'לבן' : 'שחור';
    turnBadge.className = `turn-badge ${turn === 'w' ? 'white-turn' : 'black-turn'}`;
    statusEl.textContent = `תור ה${turn === 'w' ? 'לבן' : 'שחור'} לשחק`;
}

function updateTournamentDisplay() {
    const pWins = document.getElementById('player-wins');
    const cWins = document.getElementById('computer-wins');
    if (pWins) pWins.textContent = playerWins;
    if (cWins) cWins.textContent = computerWins;
}

document.addEventListener('DOMContentLoaded', initGame);
