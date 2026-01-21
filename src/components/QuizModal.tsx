import React, { useEffect, useRef, useState } from 'react';
import type { Question } from '../data/questions';
import styles from './QuizModal.module.css';

interface QuizModalProps {
  question: Question | null;
  onAnswer: (isCorrect: boolean) => void;
  isOpen: boolean;
}

const QuizModal: React.FC<QuizModalProps> = ({ question, onAnswer, isOpen }) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // ✅ Audioはrefで「1回だけ作って使い回す」
  const correctSERef = useRef<HTMLAudioElement | null>(null);
  const wrongSERef = useRef<HTMLAudioElement | null>(null);

  // 初回だけ生成（Viteのpublic配下なので /sounds/... でOK）
  useEffect(() => {
    if (!correctSERef.current) correctSERef.current = new Audio('/sounds/correct.mp3');
    if (!wrongSERef.current) wrongSERef.current = new Audio('/sounds/wrong.mp3');
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedOption(null);
      setIsSubmitted(false);
    }
  }, [isOpen, question]);

  if (!isOpen || !question) return null;

  const playSE = (type: 'correct' | 'wrong') => {
    const audio = type === 'correct' ? correctSERef.current : wrongSERef.current;
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.volume = 0.7; // 好みで調整
      audio.play().catch(() => {
        // 自動再生制限などで鳴らない場合でも落とさない
      });
    } catch {
      // 何もしない
    }
  };

  // ✅「回答する」クリック時にだけSEを鳴らす（ユーザー操作なので確実）
  const handleSubmit = () => {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === question.correctIndex;
    playSE(isCorrect ? 'correct' : 'wrong');

    setIsSubmitted(true);
  };

  // ✅「次へ / 閉じる」はSEを鳴らさない（ここは遷移だけ）
  const handleClose = () => {
    if (selectedOption === null) {
      // 回答せずに閉じた扱い（仕様に合わせてfalse）
      onAnswer(false);
      return;
    }
    const isCorrect = selectedOption === question.correctIndex;
    onAnswer(isCorrect);
  };

  const isCorrect = selectedOption !== null && selectedOption === question.correctIndex;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>基本情報技術者試験 クイズ</h2>
        <div className={styles.questionText}>{question.text}</div>

        <div className={styles.options}>
          {question.options.map((option, index) => {
            let optionClass = styles.option;

            if (isSubmitted) {
              if (index === question.correctIndex) optionClass += ` ${styles.correct}`;
              else if (index === selectedOption) optionClass += ` ${styles.wrong}`;
            } else {
              if (selectedOption === index) optionClass += ` ${styles.selected}`;
            }

            return (
              <button
                key={index}
                type="button"
                className={optionClass}
                onClick={() => !isSubmitted && setSelectedOption(index)}
                disabled={isSubmitted}
              >
                {index + 1}. {option}
              </button>
            );
          })}
        </div>

        {isSubmitted && (
          <div className={styles.feedback}>
            {isCorrect ? (
              <div className={styles.successMessage}>
                <strong>正解！</strong>コマを配置します。<br />
                <span className={styles.explanation}>{question.explanation}</span>
                <button className={styles.closeButton} onClick={handleClose}>
                  次へ
                </button>
              </div>
            ) : (
              <div className={styles.errorMessage}>
                <strong>不正解...</strong><br />
                <span className={styles.explanation}>{question.explanation}</span>
                <button className={styles.closeButton} onClick={handleClose}>
                  閉じる
                </button>
              </div>
            )}
          </div>
        )}

        {!isSubmitted && (
          <button
            className={styles.submitButton}
            disabled={selectedOption === null}
            onClick={handleSubmit}
          >
            回答する
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizModal;
