import { useState } from 'react';
import './GameSelector.css';

/**
 * それぞれのカードに表示するアイコン（SVG）
 * - 見た目だけの部品なので、ロジックは無い
 */
const OthelloIcon = () => (
  <svg viewBox="0 0 100 100" className="game-icon">
    <circle cx="50" cy="50" r="45" fill="#2c3e50" />
    <circle cx="35" cy="35" r="10" fill="white" opacity="0.2" />
  </svg>
);

const QuizIcon = () => (
  <svg viewBox="0 0 100 100" className="game-icon">
    <circle cx="50" cy="50" r="45" fill="#3498db" />
    <text x="50" y="70" fontSize="60" textAnchor="middle" fill="white" fontWeight="bold">
      ?
    </text>
  </svg>
);

const ReviewIcon = () => (
  <svg viewBox="0 0 100 100" className="game-icon">
    <rect x="20" y="20" width="60" height="70" rx="5" fill="#fff" stroke="#333" strokeWidth="2" />
    <line x1="30" y1="35" x2="70" y2="35" stroke="#333" strokeWidth="2" />
    <line x1="30" y1="50" x2="70" y2="50" stroke="#333" strokeWidth="2" />
    <line x1="30" y1="65" x2="50" y2="65" stroke="#333" strokeWidth="2" />
    <circle cx="75" cy="75" r="15" fill="#8e44ad" />
    <path d="M70 75 L73 78 L80 72" fill="none" stroke="white" strokeWidth="2" />
  </svg>
);

/**
 * ホーム画面から選べるモードのID
 * App.tsx 側でこの文字列に応じて「どの画面を表示するか」を切り替える
 */
type GameType = 'othello' | 'quiz' | 'study';

interface GameSelectorProps {
  // ユーザーがカードをクリックした時に、親(App.tsx)へ選んだモードを返す
  onSelectGame: (game: GameType) => void;
}

export default function GameSelector({ onSelectGame }: GameSelectorProps) {
  /**
   * どのカードにマウスが乗っているか（ふわっと浮く演出用）
   * UIの見た目だけに使う状態
   */
  const [hoveredGame, setHoveredGame] = useState<GameType | null>(null);

  /**
   * ホームに出すカード一覧
   * ✅ FEクイズを先頭にして「メイン機能」を目立たせる
   */
  const games = [
    {
      id: 'quiz' as const,
      title: 'FE クイズ',
      description: '4択クイズで実力チェック!',
      bg: '#2980b9',
      Icon: QuizIcon
    },
    {
      id: 'othello' as const,
      title: 'FE オセロ',
      description: 'クイズに正解して石を置こう。正解が勝敗に直結する学習ゲーム！',
      bg: '#27ae60',
      Icon: OthelloIcon
    },
    {
      id: 'study' as const,
      title: '復習箱',
      description: '間違えた問題を復習。解説や覚え方を自分なりに編集しよう！',
      bg: '#8e44ad',
      Icon: ReviewIcon
    }
  ];

  return (
    <div className="game-selector-container">
      <header className="selector-header">
        <h1>FE STUDY POP!</h1>
        <p>基本情報技術者試験を「解く→覚える→復習する」まで一気に進めよう</p>
      </header>

      <div className="games-grid">
        {games.map((game) => (
          <div
            key={game.id}
            className="game-card"
            style={{
              borderColor: game.bg,
              transform: hoveredGame === game.id ? 'translateY(-5px)' : 'none',
              boxShadow:
                hoveredGame === game.id
                  ? `0 10px 20px -5px ${game.bg}80`
                  : '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={() => setHoveredGame(game.id)}
            onMouseLeave={() => setHoveredGame(null)}
            onClick={() => onSelectGame(game.id)}
          >
            <div className="game-icon-area" style={{ backgroundColor: game.bg }}>
              <game.Icon />
            </div>

            <div className="game-info">
              <h3>{game.title}</h3>
              <p>{game.description}</p>

              <button className="play-button" style={{ backgroundColor: game.bg }}>
                あそぶ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
