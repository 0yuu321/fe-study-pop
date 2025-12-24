export type Player = 1 | 2; // 1 = Black, 2 = White
export type Cell = Player | 0;
export type BoardState = Cell[][];

export const BOARD_SIZE = 8;

export function createInitialBoard(): BoardState {
    const board: BoardState = Array.from({ length: BOARD_SIZE }, () =>
        Array(BOARD_SIZE).fill(0)
    );
    // Standard Othello setup
    board[3][3] = 2;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = 2;
    return board;
}

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
];

export function isValidMove(board: BoardState, row: number, col: number, player: Player): boolean {
    if (board[row][col] !== 0) return false;

    const opponent = player === 1 ? 2 : 1;

    for (const [dr, dc] of DIRECTIONS) {
        let r = row + dr;
        let c = col + dc;
        let hasOpponent = false;

        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
            r += dr;
            c += dc;
            hasOpponent = true;
        }

        if (hasOpponent && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
            return true;
        }
    }

    return false;
}

export function getValidMoves(board: BoardState, player: Player): boolean[][] {
    const moves = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (isValidMove(board, r, c, player)) {
                moves[r][c] = true;
            }
        }
    }
    return moves;
}

export function makeMove(board: BoardState, row: number, col: number, player: Player): BoardState {
    if (!isValidMove(board, row, col, player)) {
        throw new Error("Invalid move");
    }

    const newBoard = board.map(row => [...row]);
    newBoard[row][col] = player;
    const opponent = player === 1 ? 2 : 1;

    for (const [dr, dc] of DIRECTIONS) {
        let r = row + dr;
        let c = col + dc;
        let flips: [number, number][] = [];

        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && newBoard[r][c] === opponent) {
            flips.push([r, c]);
            r += dr;
            c += dc;
        }

        if (flips.length > 0 && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && newBoard[r][c] === player) {
            for (const [fr, fc] of flips) {
                newBoard[fr][fc] = player;
            }
        }
    }

    return newBoard;
}

export function calculateScore(board: BoardState): { black: number; white: number } {
    let black = 0;
    let white = 0;
    board.forEach(row => row.forEach(cell => {
        if (cell === 1) black++;
        else if (cell === 2) white++;
    }));
    return { black, white };
}

export function hasValidMoves(board: BoardState, player: Player): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (isValidMove(board, r, c, player)) return true;
        }
    }
    return false;
}

export function isGameOver(board: BoardState): boolean {
    return !hasValidMoves(board, 1) && !hasValidMoves(board, 2);
}
