import { useState, useEffect } from 'react';
import Board from './components/Board';
import QuizModal from './components/QuizModal';
import {
  createInitialBoard,
  getValidMoves,
  makeMove,
  type Player,
  type BoardState,
  calculateScore,
  hasValidMoves
} from './game/othello';
import { getBestMove } from './game/ai';
import { getRandomQuestion, questions as allQuestions, type Question } from './data/questions';
import './App.css';

type GameMode = 'PvP' | 'PvE';

function App() {
  const [board, setBoard] = useState<BoardState>(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1); // 1 = Black starts
  const [validMoves, setValidMoves] = useState<boolean[][]>(() => getValidMoves(createInitialBoard(), 1));
  const [scores, setScores] = useState({ black: 2, white: 2 });
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | 0 | 'draw'>(0);

  // Game Mode State
  const [gameMode, setGameMode] = useState<GameMode>('PvE'); // Default to PvE
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Quiz State
  const [modalOpen, setModalOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [pendingMove, setPendingMove] = useState<{ r: number, c: number } | null>(null);

  // Initialize valid moves
  useEffect(() => {
    setValidMoves(getValidMoves(board, currentPlayer));
    setScores(calculateScore(board));
  }, [board, currentPlayer]);

  // AI Turn Logic
  useEffect(() => {
    // Only trigger if PvE, it's White's turn (2), game not over
    // We intentionally exclude isAiThinking from deps to avoid cancelling the timeout when state updates
    if (gameMode === 'PvE' && currentPlayer === 2 && !isGameOver && !isAiThinking) {

      // Check if AI actually has valid moves
      const hasMoves = hasValidMoves(board, 2);
      if (!hasMoves) return;

      setIsAiThinking(true);

      // Simulate thinking time
      const timer = setTimeout(() => {
        const bestMove = getBestMove(board, 2);
        if (bestMove) {
          try {
            const newBoard = makeMove(board, bestMove.r, bestMove.c, 2);
            setBoard(newBoard);
            setCurrentPlayer(1);
          } catch (e) {
            console.error("AI Move Error", e);
          }
        }
        setIsAiThinking(false);
      }, 1000 + Math.random() * 500); // 1.0 - 1.5s delay

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, gameMode, isGameOver, board]);

  // Check for turn skipping or game over
  useEffect(() => {
    if (isAiThinking) return;

    const hasMoves = hasValidMoves(board, currentPlayer);
    if (!hasMoves) {
      const opponent = currentPlayer === 1 ? 2 : 1;
      if (!hasValidMoves(board, opponent)) {
        setIsGameOver(true);
        const { black, white } = calculateScore(board);
        if (black > white) setWinner(1);
        else if (white > black) setWinner(2);
        else setWinner('draw');
      } else {
        const timer = setTimeout(() => {
          const isAiTurn = gameMode === 'PvE' && currentPlayer === 2;
          const message = isAiTurn
            ? 'CPUは置ける場所がありません。パスします。'
            : `${currentPlayer === 1 ? '黒' : '白'}は置ける場所がありません。パスします。`;

          alert(message);
          setCurrentPlayer(opponent);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [board, currentPlayer, gameMode, isAiThinking]);

  const handleCellClick = (r: number, c: number) => {
    if (isGameOver || isAiThinking) return;
    if (gameMode === 'PvE' && currentPlayer === 2) return;

    // Pick question
    const question = getRandomQuestion();
    setCurrentQuestion(question);
    setPendingMove({ r, c });
    setModalOpen(true);
  };

  const handleQuizAnswer = (isCorrect: boolean) => {
    setModalOpen(false);

    if (isCorrect && pendingMove) {
      try {
        const newBoard = makeMove(board, pendingMove.r, pendingMove.c, currentPlayer);
        setBoard(newBoard);
        setCurrentPlayer(prev => prev === 1 ? 2 : 1);
      } catch (e) {
        console.error(e);
      }
    } else {
      setCurrentPlayer(prev => prev === 1 ? 2 : 1);
    }
    setPendingMove(null);
    setCurrentQuestion(null);
  };

  const resetGame = () => {
    setBoard(createInitialBoard());
    setCurrentPlayer(1);
    setIsGameOver(false);
    setScores({ black: 2, white: 2 });
    setWinner(0);
  };

  return (
    <div className="app-container">
      <header>
        <h1>FE Exam Othello</h1>

        <div className="game-status-wrapper" style={{ display: isGameOver ? 'none' : 'flex' }}>
          <div className="game-mode-selector">
            <button
              className={gameMode === 'PvE' ? 'active-mode' : ''}
              onClick={() => setGameMode('PvE')}
            >
              1人プレイ (vs AI)
            </button>
            <button
              className={gameMode === 'PvP' ? 'active-mode' : ''}
              onClick={() => setGameMode('PvP')}
            >
              2人プレイ
            </button>
          </div>

          <div className="status-bar">
            <div className={`player-indicator ${currentPlayer === 1 ? 'active' : ''}`}>
              <span className="dot black"></span> Player 1 (黒): {scores.black}
              {gameMode === 'PvE' && currentPlayer === 1 && " (あなた)"}
            </div>
            <div className={`player-indicator ${currentPlayer === 2 ? 'active' : ''}`}>
              Player 2 (白): {scores.white} <span className="dot white"></span>
              {gameMode === 'PvE' && " (CPU)"}
              {isAiThinking && " 思考中..."}
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Results View - Hidden unless game over */}
        <div className="results-container" style={{ display: isGameOver ? 'flex' : 'none' }}>
          <h2>GAME SET</h2>
          <div className="final-score">
            <div className="score-box black-score">
              <span>黒</span>
              <span className="score-value">{scores.black}</span>
              {winner === 1 && <span className="winner-badge">WINNER</span>}
            </div>
            <div className="score-box white-score">
              <span>白</span>
              <span className="score-value">{scores.white}</span>
              {winner === 2 && <span className="winner-badge">WINNER</span>}
            </div>
          </div>

          <div className="actions">
            <button onClick={resetGame} className="primary-btn">新しいゲーム</button>
          </div>
        </div>

        {/* Board View - Hidden if game over */}
        <div style={{ display: !isGameOver ? 'block' : 'none' }}>
          <Board
            board={board}
            validMoves={validMoves}
            onCellClick={handleCellClick}
            disabled={modalOpen || isAiThinking || (gameMode === 'PvE' && currentPlayer === 2)}
          />
        </div>
      </main>

      {!isGameOver && (
        <footer>
          <button onClick={resetGame} className="reset-button">New Game</button>
        </footer>
      )}

      <QuizModal
        isOpen={modalOpen}
        question={currentQuestion}
        onAnswer={handleQuizAnswer}
      />
    </div>
  );
}

export default App;
