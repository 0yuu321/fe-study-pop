import { useState } from 'react';
import './App.css';

import GameSelector from './components/GameSelector';
import OthelloGame from './components/OthelloGame';
import FEQuizGame from './components/FEQuizGame';
import FeStudyPop from './components/FeStudyPop/FeStudyPop';

/**
 * 画面の種類（ルーティングの代わり）
 * - menu   : ホーム（ゲーム選択）
 * - othello: オセロ対決（クイズ正解で置ける）
 * - quiz   : FEクイズ単体モード
 * - study  : 復習箱（FeStudyPop）
 */
type GameType = 'menu' | 'othello' | 'quiz' | 'study';

function App() {
  /**
   * 今どの画面を表示するか
   * GameSelector のカードを押すと setCurrentView が呼ばれて画面が切り替わる
   */
  const [currentView, setCurrentView] = useState<GameType>('menu');

  // どの画面からでもホームに戻れるようにする
  const backToMenu = () => setCurrentView('menu');

  return (
    <div className="app-root">
      {/* ホーム画面（オセロ / クイズ / 復習箱 を選ぶ） */}
      {currentView === 'menu' && (
        <GameSelector onSelectGame={setCurrentView} />
      )}

      {/* オセロ対決モード */}
      {currentView === 'othello' && (
        <OthelloGame onBack={backToMenu} />
      )}

      {/* FEクイズ単体モード */}
      {currentView === 'quiz' && (
        <div className="game-wrapper">
          <header className="simple-header">
            <button className="back-button" onClick={backToMenu}>
              ← メニュー
            </button>
          </header>
          <FEQuizGame onBackToMenu={backToMenu} />
        </div>
      )}

      {/* 復習箱 */}
      {currentView === 'study' && (
        <FeStudyPop onBack={backToMenu} />
      )}
    </div>
  );
}

export default App;
