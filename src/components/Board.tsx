import React from 'react';
import type { BoardState } from '../game/othello';
import styles from './Board.module.css';

interface BoardProps {
    board: BoardState;
    validMoves: boolean[][];
    onCellClick: (row: number, col: number) => void;
    disabled: boolean;
}

const Board: React.FC<BoardProps> = ({ board, validMoves, onCellClick, disabled }) => {
    return (
        <div className={styles.boardContainer}>
            <div className={styles.board}>
                {board.map((row, rowIndex) => (
                    <div key={rowIndex} className={styles.row}>
                        {row.map((cell, colIndex) => {
                            const isValid = validMoves[rowIndex][colIndex];
                            return (
                                <div
                                    key={`${rowIndex}-${colIndex}`}
                                    className={`${styles.cell} ${isValid ? styles.valid : ''}`}
                                    onClick={() => !disabled && isValid && onCellClick(rowIndex, colIndex)}
                                >
                                    {cell !== 0 && (
                                        <div
                                            className={`${styles.piece} ${cell === 1 ? styles.black : styles.white}`}
                                        />
                                    )}
                                    {isValid && <div className={styles.validMarker} />}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Board;
