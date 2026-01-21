import { useEffect, useMemo, useState } from 'react';
import { getRandomQuestion, type Question } from '../data/questions';
import './FEQuizGame.css';

// --------------------
// 配列シャッフル（選択肢の順番を毎回変える）
// --------------------
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --------------------
// 復習箱(localStorage)に追加
// ※ FeStudyPop の復習箱キーと合わせる
// --------------------
const REVIEW_KEY = 'fe_pop_review_box_v1';

const addToReviewBox = (questionId: string) => {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(questionId)) {
      ids.push(questionId);
      localStorage.setItem(REVIEW_KEY, JSON.stringify(ids));
    }
  } catch {
    // 失敗してもゲーム自体は止めない
  }
};

// --------------------
// ✅ 効果音（正解/不正解）
// public/sounds/correct.mp3
// public/sounds/wrong.mp3
// --------------------
const playSfx = (file: 'correct.mp3' | 'wrong.mp3') => {
  try {
    const audio = new Audio(`/sounds/${file}`);
    audio.volume = 0.8;
    audio.currentTime = 0;
    void audio.play();
  } catch {
    // 失敗してもゲーム自体は止めない
  }
};

type Mode = 'normal' | 'timed';

type Props = {
  /** メニュー(ホーム)に戻したい時にApp.tsxから渡す（無ければ設定画面に戻るだけ） */
  onBackToMenu?: () => void;
};

export default function FEQuizGame({ onBackToMenu }: Props) {
  // 画面状態（start:開始前 / playing:プレイ中 / result:結果）
  const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');

  // 設定
  const [mode, setMode] = useState<Mode>('normal');
  const [limitSec, setLimitSec] = useState(10); // 時間制限(秒)
  const [totalQuestions, setTotalQuestions] = useState(5); // 1セット問題数
  const [selectedCategory, setSelectedCategory] = useState<string>('all'); // カテゴリ選択

  // 現在の問題
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);

  // 選択肢（シャッフル表示）
  const [shuffledOptions, setShuffledOptions] = useState<{ text: string; originalIndex: number }[]>([]);

  // 正誤フィードバック（アニメ表示用）
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  // 何問目か / 正解数
  const [qIndex, setQIndex] = useState(0); // 0-based
  const [correctCount, setCorrectCount] = useState(0);

  // タイマー表示（timedモード用）
  const [timeLeft, setTimeLeft] = useState(limitSec);

  // ✅ プレイ中から「設定に戻る」
  const backToSettings = () => {
    setFeedback(null);
    setCurrentQuestion(null);
    setShuffledOptions([]);
    setTimeLeft(limitSec);

    setQIndex(0);
    setCorrectCount(0);

    setGameState('start');
  };

  // ✅ メニューへ戻る（App.tsxへ戻す。未指定なら設定へ戻る）
  const backToMenu = () => {
    if (onBackToMenu) onBackToMenu();
    else backToSettings();
  };

  // timedモードの時、limitSecが変わったら timeLeft も更新
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (mode !== 'timed') return;
    setTimeLeft(limitSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitSec]);

  // 現在の問題が変わったら timeLeft リセット（timedのみ）
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (mode !== 'timed') return;
    setTimeLeft(limitSec);
  }, [currentQuestion, gameState, mode, limitSec]);

  // タイマー本体（playing & timed & 回答ロックされてない時だけ）
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (mode !== 'timed') return;
    if (!currentQuestion) return;
    if (feedback) return;

    if (timeLeft <= 0) {
      // ✅ 時間切れ = 不正解扱い → 効果音
      playSfx('wrong.mp3');

      setFeedback('wrong');
      addToReviewBox(String(currentQuestion.id));
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((v) => v - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, gameState, mode, currentQuestion, feedback]);

  // 次の問題を作る（✅ timeLeft=0残りバグ対策込み）
  const nextQuestion = () => {
    if (mode === 'timed') setTimeLeft(limitSec);

    const q = getRandomQuestion(selectedCategory);
    setCurrentQuestion(q);

    const optionsWithIndices = q.options.map((opt, idx) => ({
      text: opt,
      originalIndex: idx,
    }));

    setShuffledOptions(shuffle(optionsWithIndices));
    setFeedback(null);
  };

  // セット開始
  const startGame = () => {
    setQIndex(0);
    setCorrectCount(0);
    setGameState('playing');
    nextQuestion();
  };

  // 次へ（セット終了なら resultへ）
  const goNextQuestion = () => {
    const next = qIndex + 1;

    if (next >= totalQuestions) {
      setGameState('result');
      setFeedback(null);
      return;
    }

    setQIndex(next);
    nextQuestion();
  };

  // 選択肢クリック
  const handleChoiceClick = (originalIndex: number) => {
    if (!currentQuestion || feedback) return;

    const isCorrect = originalIndex === currentQuestion.correctIndex;

    if (isCorrect) {
      // ✅ 正解効果音
      playSfx('correct.mp3');

      setFeedback('correct');
      setCorrectCount((c) => c + 1);
    } else {
      // ✅ 不正解効果音
      playSfx('wrong.mp3');

      setFeedback('wrong');
      addToReviewBox(String(currentQuestion.id));
    }
  };

  const accuracy = useMemo(() => {
    if (totalQuestions === 0) return 0;
    return Math.round((correctCount / totalQuestions) * 100);
  }, [correctCount, totalQuestions]);

  // --------------------
  // START 画面（設定）
  // --------------------
  if (gameState === 'start') {
    return (
      <div className="quiz-container start-screen">
        <h2>FE クイズ</h2>

        <div style={{ maxWidth: 520, width: '100%', margin: '0 auto', textAlign: 'left' }}>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>カテゴリ</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
                <button
                  className={`quiz-btn ${selectedCategory === 'all' ? 'primary' : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  すべて
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className={`quiz-btn ${selectedCategory === 'technology' ? 'primary' : ''}`}
                  onClick={() => setSelectedCategory('technology')}
                >
                  テクノロジ
                </button>
                <button
                  className={`quiz-btn ${selectedCategory === 'management' ? 'primary' : ''}`}
                  onClick={() => setSelectedCategory('management')}
                >
                  マネジメント
                </button>
                <button
                  className={`quiz-btn ${selectedCategory === 'strategy' ? 'primary' : ''}`}
                  onClick={() => setSelectedCategory('strategy')}
                >
                  ストラテジ
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>モード</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={`quiz-btn ${mode === 'normal' ? 'primary' : ''}`} onClick={() => setMode('normal')}>
                通常
              </button>
              <button className={`quiz-btn ${mode === 'timed' ? 'primary' : ''}`} onClick={() => setMode('timed')}>
                時間制限
              </button>
            </div>
          </div>

          {mode === 'timed' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>制限時間</div>
              <select
                value={limitSec}
                onChange={(e) => setLimitSec(parseInt(e.target.value))}
                style={{ padding: 10, borderRadius: 10 }}
              >
                <option value={5}>5秒</option>
                <option value={10}>10秒</option>
                <option value={15}>15秒</option>
                <option value={20}>20秒</option>
              </select>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>問題数</div>
            <select
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(parseInt(e.target.value))}
              style={{ padding: 10, borderRadius: 10 }}
            >
              <option value={5}>5問</option>
              <option value={10}>10問</option>
              <option value={20}>20問</option>
            </select>
          </div>

          <p style={{ marginTop: 18, opacity: 0.85 }}>
            問題が表示されます。正解の選択肢を選んでください。
            {mode === 'timed' && (
              <>
                <br />
                （時間切れは不正解扱いになります）
              </>
            )}
          </p>
        </div>

        <button className="quiz-btn primary" onClick={startGame} style={{ marginTop: 16 }}>
          スタート
        </button>
      </div>
    );
  }

  // --------------------
  // RESULT 画面
  // --------------------
  if (gameState === 'result') {
    return (
      <div className="quiz-container start-screen">
        <h2>結果</h2>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>
          {correctCount} / {totalQuestions} 正解（{accuracy}%）
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="quiz-btn primary" onClick={startGame}>
            もう1セット
          </button>
          <button className="quiz-btn" onClick={() => setGameState('start')}>
            設定に戻る
          </button>
          <button className="quiz-btn" onClick={backToMenu}>
            メニュー
          </button>
        </div>
      </div>
    );
  }

  // --------------------
  // PLAYING 画面
  // --------------------
  const correctText = shuffledOptions.find((o) => o.originalIndex === currentQuestion?.correctIndex)?.text;

  return (
    <div className="quiz-container playing">
      {/* ✅ ここを修正：戻る + 何問目 を横並び。タイマーは右 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="quiz-btn" onClick={backToSettings}>
            ← 戻る
          </button>

          {/* ✅ 1/5 を戻るの右に並べる */}
          <div className="q-badge" style={{ marginBottom: 0 }}>
            {qIndex + 1}/{totalQuestions}
          </div>
        </div>

        {/* ✅ timedだけ右にタイマー */}
        {mode === 'timed' && <span className="time-badge">⏱ {timeLeft}s</span>}
      </div>

      <div className="question-area">
        <p className="question-text">{currentQuestion?.text}</p>
      </div>

      <div className={`cards-area ${feedback ? 'frozen' : ''}`}>
        {shuffledOptions.map((opt, i) => (
          <button
            key={i}
            className={`quiz-card ${
              feedback === 'correct' && opt.originalIndex === currentQuestion?.correctIndex ? 'card-correct' : ''
            } ${
              feedback === 'wrong' && opt.originalIndex !== currentQuestion?.correctIndex ? 'card-dim' : ''
            } ${feedback === 'wrong' && opt.text === correctText ? 'card-missed' : ''}`}
            onClick={() => handleChoiceClick(opt.originalIndex)}
            disabled={!!feedback}
          >
            {opt.text}
          </button>
        ))}
      </div>

      {feedback && (
        <div className={`feedback-overlay ${feedback}`}>
          <div className="feedback-content">
            <h2>{feedback === 'correct' ? '正解！' : '不正解...'}</h2>
            <div className="explanation-box">
              <strong>解説:</strong>
              <p>{currentQuestion?.explanation}</p>
            </div>
            <button className="next-btn" onClick={goNextQuestion}>
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
