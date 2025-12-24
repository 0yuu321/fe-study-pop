import { getValidMoves, makeMove, BOARD_SIZE, calculateScore, type BoardState, type Player } from './othello';

// Weight matrix for position evaluation (Simple heuristic)
const WEIGHTS = [
    [100, -20, 10, 5, 5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [10, -2, -1, -1, -1, -1, -2, 10],
    [5, -2, -1, -1, -1, -1, -2, 5],
    [5, -2, -1, -1, -1, -1, -2, 5],
    [10, -2, -1, -1, -1, -1, -2, 10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10, 5, 5, 10, -20, 100]
];

export function getBestMove(board: BoardState, player: Player): { r: number, c: number } | null {
    const validMoves = getValidMoves(board, player);
    let bestScore = -Infinity;
    let bestMove: { r: number, c: number } | null = null;

    const potentialMoves: { r: number, c: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (validMoves[r][c]) {
                potentialMoves.push({ r, c });
            }
        }
    }

    if (potentialMoves.length === 0) return null;

    for (const move of potentialMoves) {
        // 1. Evaluate position weight
        let score = WEIGHTS[move.r][move.c];

        // 2. Simulate move to see piece difference (maximize gain)
        // Note: This is computationally expensive if depth is high, but for depth 1 it's fine.
        // We can also just add a small factor for number of flips.
        try {
            const nextBoard = makeMove(board, move.r, move.c, player);
            const { black, white } = calculateScore(nextBoard);
            const myScore = player === 1 ? black : white;
            score += myScore; // Add current piece count to prefer capturing
        } catch (e) {
            // Ignore invalid moves (shouldn't happen)
        }

        // Add some randomness so it's not perfectly predictable
        score += Math.random() * 5;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}
