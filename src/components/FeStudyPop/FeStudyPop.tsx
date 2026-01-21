import { useEffect, useMemo, useState } from 'react';
import './FeStudyPop.css';
import { questions as SOURCE_QUESTIONS } from '../../data/questions';

// --------------------
// 型定義（問題・成績）
// --------------------
type Question = {
  id: string;
  q: string;
  choices: string[];
  answer: number;
  explain: string;
  mnemonic: string;
  category: string;
};

type QuestionStats = {
  attempts: number;
  correct: number;
};

// --------------------
// プリセット問題（例）+ 外部questions.ts から取り込み
// --------------------
const ORIGINAL_BASE: Question[] = [
  {
    id: 'base-rasis-a',
    q: '「RASIS」の「A」が指すものはどれ？',
    choices: ['Availability（可用性）', 'Accountability（責任追跡性）', 'Authenticity（真正性）', 'Authority（権限）'],
    answer: 0,
    explain: 'RASISは信頼性の指標。AはAvailability（可用性）。稼働し続けられるか、使える状態か。',
    mnemonic: 'A＝Available（使える）',
    category: 'management',
  },
  {
    id: 'base-sql-select',
    q: 'SQLで表からデータを取り出す基本は？',
    choices: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'],
    answer: 1,
    explain: 'SELECTは取得。INSERTは追加、UPDATEは更新、DELETEは削除。',
    mnemonic: 'SELECT＝選んで取る',
    category: 'technology',
  },
  {
    id: 'base-url-query',
    q: 'URLの ?a=1&b=2 の部分は何と呼ぶ？',
    choices: ['パス', 'クエリパラメータ', 'ヘッダ', 'レスポンスボディ'],
    answer: 1,
    explain: 'クエリパラメータ。検索条件などをURLに付けて渡す。',
    mnemonic: '? 以降は質問（Query）と覚える',
    category: 'technology',
  },
];

// SOURCE_QUESTIONS（別ファイルの問題）をこの画面用の形式に変換
const IMPORTED_QUESTIONS: Question[] = SOURCE_QUESTIONS.map((q) => ({
  id: String(q.id),
  q: q.text,
  choices: q.options,
  answer: q.correctIndex,
  explain: q.explanation,
  mnemonic: '',
  category: q.category || 'unknown',
}));

const BASE_QUESTIONS: Question[] = [...ORIGINAL_BASE, ...IMPORTED_QUESTIONS];

// --------------------
// localStorageキー（保存先）
// --------------------
const LS = {
  stats: 'fe_pop_stats_v1',
  review: 'fe_pop_review_box_v1',
  notes: 'fe_pop_notes_v1',
};

// --------------------
// 卒業（自動で復習箱から外れる）条件
// --------------------
const GRAD_THRESHOLD = 70;
const GRAD_MIN_ATTEMPTS = 3;

interface Props {
  onBack: () => void;
}

type ReviewCategory = 'all' | 'technology' | 'management' | 'strategy';

export default function FeStudyPop({ onBack }: Props) {
  /**
   * この画面は「復習箱」専用
   * - review : 復習箱一覧
   * - quiz   : 復習出題
   * - notes  : 自分メモ一覧
   */
  const [view, setView] = useState<'review' | 'quiz' | 'notes'>('review');

  const [stats, setStats] = useState<Record<string, QuestionStats>>({});
  const [reviewBox, setReviewBox] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, { explain: string; mnemonic: string }>>({});
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'ng' } | null>(null);

  // ★復習カテゴリ（ドロップダウン）
  const [selectedReviewCategory, setSelectedReviewCategory] = useState<ReviewCategory>('all');

  // 復習出題（quiz）用
  const [quizPool, setQuizPool] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; msg: string } | null>(null);
  const [editNote, setEditNote] = useState({ explain: '', mnemonic: '' });

  // --------------------
  // 保存ヘルパー
  // --------------------
  const save = (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val));
  const updateStats = (data: Record<string, QuestionStats>) => {
    setStats(data);
    save(LS.stats, data);
  };
  const updateReview = (data: string[]) => {
    setReviewBox(data);
    save(LS.review, data);
  };
  const updateNotes = (data: Record<string, any>) => {
    setNotes(data);
    save(LS.notes, data);
  };

  const showToast = (msg: string, kind: 'ok' | 'ng') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2500);
  };

  // --------------------
  // 問題一覧（id→Question）を作る
  // --------------------
  const allQuestionsMap = useMemo(() => {
    const map: Record<string, Question> = {};
    BASE_QUESTIONS.forEach((q) => (map[q.id] = { ...q }));

    // メモで上書き
    Object.keys(notes).forEach((id) => {
      if (!map[id]) return;
      if (notes[id]?.explain) map[id].explain = notes[id].explain;
      if (notes[id]?.mnemonic) map[id].mnemonic = notes[id].mnemonic;
    });

    return map;
  }, [notes]);

  const getStat = (id: string) => stats[id] || { attempts: 0, correct: 0 };
  const getAcc = (id: string) => {
    const s = getStat(id);
    return s.attempts === 0 ? 0 : Math.round((s.correct / s.attempts) * 100);
  };

  // --------------------
  // ✅ 重要：ID補正（imp-の付け外し）
  // --------------------
  const normalizeId = (id: string) => {
    if (allQuestionsMap[id]) return id;

    if (id.startsWith('imp-')) {
      const raw = id.slice(4);
      if (allQuestionsMap[raw]) return raw;
    }

    const withImp = `imp-${id}`;
    if (allQuestionsMap[withImp]) return withImp;

    return null as any;
  };

  // --------------------
  // 起動時：localStorageから読み込み + 復習箱IDを自動移行
  // --------------------
  useEffect(() => {
    const load = <T,>(key: string, def: T): T => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : def;
      } catch {
        return def;
      }
    };

    const loadedStats = load<Record<string, QuestionStats>>(LS.stats, {});
    const loadedNotes = load<Record<string, { explain: string; mnemonic: string }>>(LS.notes, {});
    const loadedReview = load<string[]>(LS.review, []);

    setStats(loadedStats);
    setNotes(loadedNotes);

    const normalized = Array.from(new Set(loadedReview.map((id) => normalizeId(id)).filter(Boolean))) as string[];

    setReviewBox(normalized);
    save(LS.review, normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------
  // 卒業判定
  // --------------------
  const checkAndAutoRemoveFromReview = (id: string, nextStats?: Record<string, QuestionStats>) => {
    if (!reviewBox.includes(id)) return;

    const s = nextStats && nextStats[id] ? nextStats[id] : getStat(id);
    const acc = s.attempts === 0 ? 0 : Math.round((s.correct / s.attempts) * 100);

    if (s.attempts >= GRAD_MIN_ATTEMPTS && acc >= GRAD_THRESHOLD) {
      const next = reviewBox.filter((x) => x !== id);
      updateReview(next);
      showToast(`復習箱から卒業！（正答率 ${acc}%）`, 'ok');
    }
  };

  // --------------------
  // 復習出題：優先順で並べる
  // --------------------
  const buildReviewPoolSorted = (sourceIds: string[] = reviewBox) => {
    const normalized = Array.from(new Set(sourceIds.map((id) => normalizeId(id)).filter(Boolean))) as string[];

    // 復習箱の掃除（reviewBoxを使ったときだけ）
    if (sourceIds === reviewBox && normalized.length !== reviewBox.length) {
      updateReview(normalized);
    }

    normalized.sort((a, b) => {
      const aStat = getStat(a);
      const bStat = getStat(b);

      const aReady = aStat.attempts >= GRAD_MIN_ATTEMPTS;
      const bReady = bStat.attempts >= GRAD_MIN_ATTEMPTS;

      if (aReady !== bReady) return aReady ? -1 : 1;

      const accA = aStat.attempts === 0 ? 0 : Math.round((aStat.correct / aStat.attempts) * 100);
      const accB = bStat.attempts === 0 ? 0 : Math.round((bStat.correct / bStat.attempts) * 100);
      if (accA !== accB) return accA - accB;

      return bStat.attempts - aStat.attempts;
    });

    return normalized;
  };

  // --------------------
  // ★カテゴリで復習箱IDを絞る
  // --------------------
  const filterReviewIdsByCategory = (cat: ReviewCategory) => {
    const normalized = Array.from(new Set(reviewBox.map((id) => normalizeId(id)).filter(Boolean))) as string[];

    if (cat === 'all') return normalized;

    return normalized.filter((id) => {
      const q = allQuestionsMap[id];
      return q?.category === cat;
    });
  };

  // カテゴリ別件数（select表示用）
  const countByCategory = useMemo(() => {
    const all = filterReviewIdsByCategory('all').length;
    const technology = filterReviewIdsByCategory('technology').length;
    const management = filterReviewIdsByCategory('management').length;
    const strategy = filterReviewIdsByCategory('strategy').length;
    return { all, technology, management, strategy };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewBox, allQuestionsMap]);

  // ✅ 表示用：カテゴリで絞った復習箱を、優先順で並べた配列
  const visibleReviewIds = useMemo(() => {
    const filtered = filterReviewIdsByCategory(selectedReviewCategory);
    return buildReviewPoolSorted(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewBox, stats, selectedReviewCategory, allQuestionsMap]);

  // --------------------
  // 復習開始（★カテゴリ対応）
  // --------------------
  const startReview = (cat: ReviewCategory) => {
    const filteredIds = filterReviewIdsByCategory(cat);
    const ids = buildReviewPoolSorted(filteredIds);

    if (ids.length === 0) {
      if (reviewBox.length === 0) return showToast('復習箱は空です', 'ng');
      return showToast('そのカテゴリの復習問題がありません', 'ng');
    }

    setQuizPool(ids);
    setCurrentIdx(0);
    setIsLocked(false);
    setResult(null);
    setView('quiz');
  };

  const getCurrentQuestion = () => {
    const id = quizPool[currentIdx];
    return allQuestionsMap[id];
  };

  // --------------------
  // 回答処理
  // --------------------
  const handleAnswer = (choiceIdx: number) => {
    if (isLocked) return;
    const q = getCurrentQuestion();
    if (!q) return;

    setIsLocked(true);

    const isCorrect = choiceIdx === q.answer;

    const s = { ...getStat(q.id) };
    s.attempts++;
    if (isCorrect) s.correct++;

    const nextStats = { ...stats, [q.id]: s };
    updateStats(nextStats);

    setResult({ correct: isCorrect, msg: isCorrect ? '正解！' : '不正解...' });

    checkAndAutoRemoveFromReview(q.id, nextStats);

    const note = notes[q.id] || { explain: q.explain, mnemonic: q.mnemonic };
    setEditNote({ explain: note.explain || '', mnemonic: note.mnemonic || '' });
  };

  // 次へ / 終了
  const goNext = () => {
    if (currentIdx + 1 >= quizPool.length) {
      setView('review');
      return;
    }
    setCurrentIdx(currentIdx + 1);
    setIsLocked(false);
    setResult(null);
  };

  const q = getCurrentQuestion();

  return (
    <div className="fe-study-pop">
      <div className="wrap">
        <header>
          <div>
            {/* <div className="brand">復習箱</div>
            <div className="tag">間違えた問題を自動管理して、苦手を潰す</div> */}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="app-back-btn" onClick={onBack}>
              ← メニュー
            </button>
          </div>
        </header>

        {/* --------------------
            REVIEW（復習箱一覧）
           -------------------- */}
        {view === 'review' && (
          <section className="section active">
            <div className="card">
              <div className="row">
                <div>
                  <div className="h1">復習箱</div>
                  <div className="muted small">間違えた問題がここに入ります（優先順で出題）</div>
                </div>

                <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn primary"
                    disabled={reviewBox.length === 0}
                    onClick={() => startReview(selectedReviewCategory)}
                  >
                    復習開始
                  </button>

                  <button className="btn" onClick={() => setView('notes')}>
                    自分メモ
                  </button>
                  <button className="btn danger" onClick={() => updateReview([])}>
                    箱を空にする
                  </button>
                </div>
              </div>

              <div className="divider"></div>

              {/* ✅ ここが修正点：左にカテゴリselectだけ置く / 復習箱58・削除条件・表示中は消す */}
              <div className="row" style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 12 }}>
                <select
                  className="review-category-select"
                  value={selectedReviewCategory}
                  onChange={(e) => setSelectedReviewCategory(e.target.value as ReviewCategory)}
                  disabled={reviewBox.length === 0}
                  aria-label="復習カテゴリ"
                >
                  <option value="all">すべて（{countByCategory.all}）</option>
                  <option value="technology">テクノロジ（{countByCategory.technology}）</option>
                  <option value="management">マネジメント（{countByCategory.management}）</option>
                  <option value="strategy">ストラテジ（{countByCategory.strategy}）</option>
                </select>
              </div>

              <div className="divider"></div>

              <div style={{ overflow: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>カテゴリ</th>
                      <th>問題</th>
                      <th>正答率</th>
                      <th>削除</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReviewIds.map((id) => {
                      const dq = allQuestionsMap[id];
                      return (
                        <tr key={id}>
                          <td>
                            <span
                              className="chip"
                              style={{
                                background:
                                  dq?.category === 'technology'
                                    ? '#e3f2fd'
                                    : dq?.category === 'management'
                                    ? '#e8f5e9'
                                    : dq?.category === 'strategy'
                                    ? '#fff3e0'
                                    : '#f5f5f5',
                                color: '#333',
                                padding: '2px 6px',
                                borderRadius: 4,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {dq?.category === 'technology'
                                ? 'テクノロジ'
                                : dq?.category === 'management'
                                ? 'マネジメント'
                                : dq?.category === 'strategy'
                                ? 'ストラテジ'
                                : 'その他'}
                            </span>
                          </td>
                          <td>{dq ? dq.q : id}</td>
                          <td>{getAcc(id)}%</td>
                          <td>
                            <button
                              className="btn ghost"
                              title="復習箱から削除"
                              onClick={() => {
                                updateReview(reviewBox.filter((x) => x !== id));
                                showToast('復習箱から削除しました', 'ok');
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {visibleReviewIds.length === 0 && reviewBox.length > 0 && (
                <div className="muted small" style={{ marginTop: 10 }}>
                  ※ このカテゴリには復習問題がありません（またはIDの形式が合っていない可能性があります）
                </div>
              )}

              {reviewBox.length === 0 && (
                <div className="muted small" style={{ marginTop: 10 }}>
                  ※ 復習箱は空です
                </div>
              )}
            </div>

            {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
          </section>
        )}

        {/* --------------------
            QUIZ（復習出題）
           -------------------- */}
        {view === 'quiz' && q && (
          <section className="section active">
            <div className="card">
              <div className="row">
                <div className="pill">
                  Q <b>{currentIdx + 1}</b>/<b>{quizPool.length}</b>
                </div>
                <div className="pill">
                  正答率 <b>{getAcc(q.id)}%</b>
                </div>
              </div>

              <div className="q">{q.q}</div>

              <div className="choices">
                {q.choices.map((c, i) => (
                  <button
                    key={i}
                    className={`choice ${isLocked && q.answer === i ? 'ok' : ''} ${
                      isLocked && q.answer !== i && result?.correct === false ? 'dim' : ''
                    }`}
                    onClick={() => handleAnswer(i)}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="divider"></div>

              <div className="row">
                <button className="btn" disabled={!isLocked} onClick={goNext}>
                  {currentIdx + 1 >= quizPool.length ? '終了' : '次へ'}
                </button>
                <button className="btn ghost" onClick={() => setView('review')}>
                  中断する
                </button>
              </div>

              {result && (
                <div className={`toast ${result.correct ? 'ok' : 'ng'}`}>
                  <b>{result.msg}</b>
                  <div className="muted small" style={{ marginTop: 6 }}>
                    試行 {getStat(q.id).attempts}回 / 正答 {getStat(q.id).correct}回
                  </div>
                </div>
              )}
            </div>

            {/* 回答後だけ出す：解説＆覚え方（メモ）編集 */}
            {isLocked && (
              <div className="card">
                <div className="h1" style={{ margin: 0 }}>
                  解説＆覚え方（自分メモ）
                </div>
                <div className="muted small">自分の言葉に直すと記憶に残りやすい!</div>
                <div className="divider"></div>

                <label>解説</label>
                <textarea
                  value={editNote.explain}
                  onChange={(e) => setEditNote({ ...editNote, explain: e.target.value })}
                />

                <label>覚え方</label>
                <textarea
                  value={editNote.mnemonic}
                  onChange={(e) => setEditNote({ ...editNote, mnemonic: e.target.value })}
                />

                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    className="btn primary"
                    onClick={() => {
                      updateNotes({ ...notes, [q.id]: editNote });
                      showToast('メモを保存しました', 'ok');
                    }}
                  >
                    保存
                  </button>

                  <button
                    className="btn"
                    onClick={() => {
                      if (reviewBox.includes(q.id)) {
                        updateReview(reviewBox.filter((x) => x !== q.id));
                        showToast('復習箱から削除しました', 'ok');
                      } else {
                        updateReview([...reviewBox, q.id]);
                        showToast('復習箱に入れました', 'ok');
                      }
                    }}
                  >
                    {reviewBox.includes(q.id) ? '復習箱から削除' : '復習箱に入れる'}
                  </button>
                </div>
              </div>
            )}

            {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
          </section>
        )}

        {/* --------------------
            NOTES（自分メモ一覧）
           -------------------- */}
        {view === 'notes' && (
          <section className="section active">
            <div className="card">
              <div className="row">
                <div>
                  <div className="h1">自分メモ</div>
                  <div className="muted small">保存した覚え方や解説を系統別に確認できます</div>
                </div>
                <button className="btn ghost" onClick={() => setView('review')}>
                  戻る
                </button>
              </div>

              <div className="divider"></div>

              {(() => {
                const noteIds = Object.keys(notes);
                if (noteIds.length === 0) return <div className="muted p-2">メモはまだありません</div>;

                const grouped: Record<string, string[]> = { technology: [], management: [], strategy: [], other: [] };
                noteIds.forEach((id) => {
                  const q = allQuestionsMap[id];
                  const cat = q?.category || 'other';
                  if (grouped[cat as keyof typeof grouped]) grouped[cat as keyof typeof grouped].push(id);
                  else grouped.other.push(id);
                });

                const renderGroup = (label: string, ids: string[]) => {
                  if (ids.length === 0) return null;
                  return (
                    <div key={label} style={{ marginBottom: 30 }}>
                      <div
                        style={{
                          background: '#ffffffba',
                          padding: '8px 12px',
                          borderRadius: 6,
                          fontWeight: 'bold',
                          marginBottom: 10,
                          color: '#555',
                        }}
                      >
                        {label} ({ids.length})
                      </div>

                      <div className="notes-grid">
                        {ids.map((id) => {
                          const q = allQuestionsMap[id];
                          const note = notes[id];

                          return (
                            <div
                              key={id}
                              className="note-item"
                              style={{
                                border: '1px solid #eee',
                                padding: 15,
                                borderRadius: 8,
                                marginBottom: 10,
                                background: '#ffffffba',
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 'bold',
                                  marginBottom: 12,
                                  fontSize: '1rem',
                                  color: '#333',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <div>
                                  <span
                                    className="chip"
                                    style={{
                                      fontSize: '0.7rem',
                                      marginRight: 8,
                                      verticalAlign: 'middle',
                                      background: '#eee',
                                      color: '#555',
                                    }}
                                  >
                                    {/* ID:{id} */}
                                  </span>
                                  {q ? q.q : '(問題が見つかりません)'}
                                </div>

                                <button
                                  className="btn ghost"
                                  style={{ padding: '4px 8px', fontSize: '1rem', color: '#eeeaea' }}
                                  onClick={() => {
                                    if (!window.confirm('このメモを削除しますか？')) return;
                                    const nextNotes = { ...notes };
                                    delete nextNotes[id];
                                    updateNotes(nextNotes);
                                    showToast('メモを削除しました', 'ok');
                                  }}
                                >
                                  🗑 削除
                                </button>
                              </div>

                              <div style={{ display: 'grid', gap: 15 }}>
                                <div>
                                  <label
                                    style={{
                                      display: 'block',
                                      fontSize: '0.85rem',
                                      color: '#e67e22',
                                      fontWeight: 'bold',
                                      marginBottom: 4,
                                    }}
                                  >
                                    💡 覚え方
                                  </label>
                                  <textarea
                                    defaultValue={note.mnemonic}
                                    onBlur={(e) => {
                                      const newVal = e.target.value;
                                      if (notes[id].mnemonic === newVal) return;
                                      updateNotes({ ...notes, [id]: { ...note, mnemonic: newVal } });
                                      showToast('覚え方を更新しました', 'ok');
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: 10,
                                      borderRadius: 6,
                                      border: '1px solid #ddd',
                                      minHeight: 60,
                                      fontFamily: 'inherit',
                                    }}
                                    placeholder="ここに入力..."
                                  />
                                </div>

                                <div>
                                  <label
                                    style={{
                                      display: 'block',
                                      fontSize: '0.85rem',
                                      color: '#2c3e50',
                                      fontWeight: 'bold',
                                      marginBottom: 4,
                                    }}
                                  >
                                    📝 解説メモ
                                  </label>
                                  <textarea
                                    defaultValue={note.explain}
                                    onBlur={(e) => {
                                      const newVal = e.target.value;
                                      if (notes[id].explain === newVal) return;
                                      updateNotes({ ...notes, [id]: { ...note, explain: newVal } });
                                      showToast('解説メモを更新しました', 'ok');
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: 10,
                                      borderRadius: 6,
                                      border: '1px solid #ddd',
                                      minHeight: 80,
                                      fontFamily: 'inherit',
                                    }}
                                    placeholder="ここに入力..."
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                return (
                  <div>
                    {renderGroup('テクノロジ系', grouped.technology)}
                    {renderGroup('マネジメント系', grouped.management)}
                    {renderGroup('ストラテジ系', grouped.strategy)}
                    {renderGroup('その他', grouped.other)}
                  </div>
                );
              })()}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
