import { useEffect, useRef, useState } from 'react';
import Board from './Board';
import QuizModal from './QuizModal';
import {
  createInitialBoard,
  getValidMoves,
  makeMove,
  type Player,
  type BoardState,
  calculateScore,
  hasValidMoves,
} from '../game/othello';
import { getBestMove } from '../game/ai';
import { getRandomQuestion, type Question } from '../data/questions';

interface OthelloGameProps {
  onBack: () => void;
}

const REVIEW_KEY = 'fe_pop_review_box_v1';

const addToReviewBox = (questionId: string) => {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(questionId)) {
      ids.push(questionId);
      localStorage.setItem(REVIEW_KEY, JSON.stringify(ids));
    }
  } catch {}
};

// 🔊 音量（好みで調整OK）
const BGM_VOL_NORMAL = 0.35;
const BGM_VOL_QUIZ = 0.12;

// 🔊 勝敗SE音量
const WIN_VOL = 0.8;
const LOSE_VOL = 0.8;

// 🔊 クイズ正誤SE音量
const QUIZ_SE_VOL = 0.8;

// ✅ GitHub Pages対応：/fe-study-pop/ を自動で付ける
const soundUrl = (file: string) => `${import.meta.env.BASE_URL}sounds/${file}`;

export default function OthelloGame({ onBack }: OthelloGameProps) {
  // Game Mode State ('start' | 'playing')
  const [gameState, setGameState] = useState<'start' | 'playing'>('start');
  const [gameMode, setGameMode] = useState<'cpu' | '2p'>('cpu');

  const [board, setBoard] = useState<BoardState>(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [validMoves, setValidMoves] = useState<boolean[][]>(() => getValidMoves(createInitialBoard(), 1));
  const [scores, setScores] = useState({ black: 2, white: 2 });
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | 0 | 'draw'>(0);

  const [isAiThinking, setIsAiThinking] = useState(false);

  // Quiz State
  const [modalOpen, setModalOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [pendingMove, setPendingMove] = useState<{ r: number; c: number } | null>(null);

  // --------------------
  // ✅ BGM + ミュート
  // --------------------
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // --------------------
  // ✅ 勝敗SE（win/lose）
  // --------------------
  const winSERef = useRef<HTMLAudioElement | null>(null);
  const loseSERef = useRef<HTMLAudioElement | null>(null);

  // --------------------
  // ✅ クイズSE（correct/wrong）
  // --------------------
  const correctSERef = useRef<HTMLAudioElement | null>(null);
  const wrongSERef = useRef<HTMLAudioElement | null>(null);

  // 初回だけ生成
  useEffect(() => {
    if (!bgmRef.current) {
      const bgm = new Audio(soundUrl('BGM.mp3'));
      bgm.loop = true;
      bgm.volume = BGM_VOL_NORMAL;
      bgmRef.current = bgm;
    }

    if (!winSERef.current) {
      const win = new Audio(soundUrl('win.mp3'));
      win.volume = WIN_VOL;
      winSERef.current = win;
    }

    if (!loseSERef.current) {
      const lose = new Audio(soundUrl('lose.mp3'));
      lose.volume = LOSE_VOL;
      loseSERef.current = lose;
    }

    // ✅ クイズ正誤SE
    if (!correctSERef.current) {
      const a = new Audio(soundUrl('correct.mp3'));
      a.volume = QUIZ_SE_VOL;
      correctSERef.current = a;
    }
    if (!wrongSERef.current) {
      const a = new Audio(soundUrl('wrong.mp3'));
      a.volume = QUIZ_SE_VOL;
      wrongSERef.current = a;
    }
  }, []);

  const playQuizSE = (isCorrect: boolean) => {
    if (isMuted) return;
    const a = isCorrect ? correctSERef.current : wrongSERef.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      void a.play();
    } catch {}
  };

  // ✅ 再生/停止と音量制御（クイズ中は小さく）
  useEffect(() => {
    const bgm = bgmRef.current;
    if (!bgm) return;

    if (isMuted) {
      bgm.pause();
      return;
    }

    const shouldPlay = gameState === 'playing' && !isGameOver;

    if (shouldPlay) {
      bgm.volume = modalOpen ? BGM_VOL_QUIZ : BGM_VOL_NORMAL;
      bgm.play().catch(() => {});
    } else {
      bgm.pause();
      bgm.currentTime = 0;
      bgm.volume = BGM_VOL_NORMAL;
    }
  }, [gameState, modalOpen, isGameOver, isMuted]);

  // ✅ 画面を離れる時は停止
  useEffect(() => {
    return () => {
      const bgm = bgmRef.current;
      if (!bgm) return;
      bgm.pause();
      bgm.currentTime = 0;
    };
  }, []);

  // ✅ GAME SET になった瞬間に勝敗SE（1回だけ）
  const prevGameOverRef = useRef(false);
  useEffect(() => {
    const becameGameOver = !prevGameOverRef.current && isGameOver;
    prevGameOverRef.current = isGameOver;

    if (!becameGameOver) return;
    if (isMuted) return;

    // BGM止める（演出）
    const bgm = bgmRef.current;
    if (bgm) {
      bgm.pause();
      bgm.currentTime = 0;
      bgm.volume = BGM_VOL_NORMAL;
    }

    // CPUモードなら「あなた(黒)」基準で win/lose
    if (gameMode === 'cpu') {
      if (winner === 1) {
        const a = winSERef.current;
        if (a) {
          a.currentTime = 0;
          a.play().catch(() => {});
        }
      } else if (winner === 2) {
        const a = loseSERef.current;
        if (a) {
          a.currentTime = 0;
          a.play().catch(() => {});
        }
      }
    }
  }, [isGameOver, winner, gameMode, isMuted]);

  // 置ける場所＆スコア更新
  useEffect(() => {
    setValidMoves(getValidMoves(board, currentPlayer));
    setScores(calculateScore(board));
  }, [board, currentPlayer]);

  // --------------------
  // ✅ AI Turn Logic（改善版：isAiThinkingを依存配列に入れない）
  // --------------------
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (gameMode !== 'cpu') return;
    if (currentPlayer !== 2) return;
    if (isGameOver) return;

    // もう思考中なら二重発火させない
    if (isAiThinking) return;

    // 置けないならパス判定側に任せる
    if (!hasValidMoves(board, 2)) return;

    setIsAiThinking(true);

    const timer = window.setTimeout(() => {
      try {
        const bestMove = getBestMove(board, 2);
        if (bestMove) {
          const newBoard = makeMove(board, bestMove.r, bestMove.c, 2);
          setBoard(newBoard);
          setCurrentPlayer(1);
        } else {
          setCurrentPlayer(1);
        }
      } catch (e) {
        console.error('AI Move Error', e);
        setCurrentPlayer(1);
      } finally {
        setIsAiThinking(false);
      }
    }, 800);

    return () => window.clearTimeout(timer);

    // ✅ ここが重要：isAiThinking は依存に入れない（入れるとタイマーが消える）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, currentPlayer, gameMode, gameState, isGameOver]);

  // パス判定 / ゲーム終了判定
  useEffect(() => {
    if (gameState !== 'playing') return;
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
          let message = '';
          if (gameMode === 'cpu') {
            message =
              currentPlayer === 2
                ? 'CPUは置ける場所がありません。パスします。'
                : 'あなたは置ける場所がありません。パスします。';
          } else {
            message =
              currentPlayer === 1
                ? '黒（プレイヤー1）は置ける場所がありません。パスします。'
                : '白（プレイヤー2）は置ける場所がありません。パスします。';
          }
          alert(message);
          setCurrentPlayer(opponent);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [board, currentPlayer, isAiThinking, gameMode, gameState]);

  // マスクリック
  const handleCellClick = (r: number, c: number) => {
    if (isGameOver || isAiThinking) return;
    if (gameState !== 'playing') return;
    if (gameMode === 'cpu' && currentPlayer === 2) return;

    const question = getRandomQuestion();
    setCurrentQuestion(question);
    setPendingMove({ r, c });
    setModalOpen(true);
  };

  // クイズ回答後
  const handleQuizAnswer = (isCorrect: boolean) => {
    // ✅ ここでSE鳴らす（クリック直後なのでブラウザ的にも安全）
    playQuizSE(isCorrect);

    setModalOpen(false);

    if (!isCorrect && currentQuestion) {
      addToReviewBox(String(currentQuestion.id));
    }

    if (isCorrect && pendingMove) {
      try {
        const newBoard = makeMove(board, pendingMove.r, pendingMove.c, currentPlayer);
        setBoard(newBoard);
        setCurrentPlayer((prev) => (prev === 1 ? 2 : 1));
      } catch (e) {
        console.error(e);
      }
    } else {
      setCurrentPlayer((prev) => (prev === 1 ? 2 : 1));
    }

    setPendingMove(null);
    setCurrentQuestion(null);
  };

  const startGame = () => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
      bgmRef.current.volume = BGM_VOL_NORMAL;
      if (!isMuted) bgmRef.current.play().catch(() => {});
    }

    setBoard(createInitialBoard());
    setCurrentPlayer(1);
    setIsGameOver(false);
    setScores({ black: 2, white: 2 });
    setWinner(0);
    setIsAiThinking(false);
    setModalOpen(false);
    setCurrentQuestion(null);
    setPendingMove(null);
    setGameState('playing');
  };

  const toMenu = () => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
    setGameState('start');
  };

  const toggleSound = () => {
    setIsMuted((prev) => {
      const next = !prev;

      if (!next) {
        const bgm = bgmRef.current;
        const shouldPlay = gameState === 'playing' && !isGameOver;
        if (bgm && shouldPlay) {
          bgm.volume = modalOpen ? BGM_VOL_QUIZ : BGM_VOL_NORMAL;
          bgm.play().catch(() => {});
        }
      } else {
        const bgm = bgmRef.current;
        if (bgm) bgm.pause();
      }

      return next;
    });
  };

  // --------------------
  // start画面
  // --------------------
  if (gameState === 'start') {
    return (
      <div className="othello-game-container">
        <header className="game-header">
          <button className="back-button" onClick={onBack}>
            メニュー
          </button>
          <h1>FE Exam Othello</h1>
        </header>

        <main
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 32,
            marginTop: 24,
          }}
        >
          <h2 style={{ margin: 0 }}>対戦モード選択</h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 20,
              width: 'min(520px, 92vw)',
            }}
          >
            <button
              className={`mode-btn ${gameMode === 'cpu' ? 'selected-mode' : ''}`}
              onClick={() => setGameMode('cpu')}
              style={{
                width: '100%',
                maxWidth: 270,
                padding: '14px 40px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                border: gameMode === 'cpu' ? '3px solid #4CAF50' : '1px solid #ccc',
                borderRadius: 8,
                background: gameMode === 'cpu' ? '#e8f5e9' : 'white',
                color: '#333',
              }}
            >
              CPU対戦
              <div style={{ fontSize: '0.9rem', marginTop: 8, color: '#666' }}>コンピュータと対戦します</div>
            </button>

            <button
              className={`mode-btn ${gameMode === '2p' ? 'selected-mode' : ''}`}
              onClick={() => setGameMode('2p')}
              style={{
                width: '100%',
                maxWidth: 270,
                padding: '14px 24px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                border: gameMode === '2p' ? '3px solid #2196F3' : '1px solid #ccc',
                borderRadius: 8,
                background: gameMode === '2p' ? '#e3f2fd' : 'white',
                color: '#333',
              }}
            >
              2人対戦
              <div style={{ fontSize: '0.9rem', marginTop: 8, color: '#666', width: '100%' }}>
                同じ端末で2人で対戦します
              </div>
            </button>
          </div>

          <button
            onClick={startGame}
            style={{
              padding: '12px 60px',
              fontSize: '1.5rem',
              background: '#333',
              color: 'white',
              border: 'none',
              borderRadius: 30,
              cursor: 'pointer',
            }}
          >
            GAME START
          </button>
        </main>
      </div>
    );
  }

  const headerLeft = isGameOver ? (
    <div style={{ width: 1 }} />
  ) : (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <button className="back-button" onClick={toMenu}>
        戻る
      </button>

      <button
        type="button"
        onClick={toggleSound}
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          cursor: 'pointer',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {isMuted ? '🔇 OFF' : '🔊 ON'}
      </button>
    </div>
  );

  return (
    <div className="othello-game-container">
      <header className="game-header">
        {headerLeft}

        <h1>FE Exam Othello {gameMode === '2p' ? '(2P Mode)' : ''}</h1>

        <div className="game-status-wrapper" style={{ display: isGameOver ? 'none' : 'flex' }}>
          <div className="status-bar">
            <div className={`player-indicator ${currentPlayer === 1 ? 'active' : ''}`}>
              <span className="dot black"></span> {gameMode === '2p' ? 'Player 1 (黒)' : 'あなた（黒）'}: {scores.black}
            </div>
            <div className={`player-indicator ${currentPlayer === 2 ? 'active' : ''}`}>
              {gameMode === '2p' ? 'Player 2 (白)' : 'CPU（白）'}: {scores.white} <span className="dot white"></span>
              {isAiThinking && ' 思考中...'}
            </div>
          </div>
        </div>
      </header>

      <main>
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

          <div className="actions" style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <button onClick={startGame} className="primary-btn">
              同じモードで再戦
            </button>
            <button onClick={toMenu} className="secondary-btn">
              戻る
            </button>
          </div>
        </div>

        <div style={{ display: !isGameOver ? 'block' : 'none' }}>
          <Board
            board={board}
            validMoves={validMoves}
            onCellClick={handleCellClick}
            disabled={modalOpen || isAiThinking || (gameMode === 'cpu' && currentPlayer === 2)}
          />
        </div>
      </main>

      {!isGameOver && (
        <footer>
          <button onClick={startGame} className="reset-button">
            やり直す
          </button>
        </footer>
      )}

      <QuizModal isOpen={modalOpen} question={currentQuestion} onAnswer={handleQuizAnswer} />
    </div>
  );
}
