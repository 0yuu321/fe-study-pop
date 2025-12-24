import React, { useState, useEffect } from 'react';
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

    useEffect(() => {
        if (isOpen) {
            setSelectedOption(null);
            setIsSubmitted(false);
        }
    }, [isOpen, question]);

    if (!isOpen || !question) return null;

    const handleSubmit = () => {
        if (selectedOption === null) return;

        const isCorrect = selectedOption === question.correctIndex;
        setIsSubmitted(true);

        if (isCorrect) {
            // Small delay to show success state before closing
            setTimeout(() => {
                onAnswer(true);
            }, 1000);
        } else {
            // Wait for user to read explanation before closing (user must click cancel or try again logic? For now, move is forfeited)
            // Requirement: "If they don't answer correctly, they don't get advantage". 
            // We can simply close it after a delay or let them close it.
            // Let's provide a "Close" button for incorrect answers.
        }
    };

    const handleClose = () => {
        onAnswer(false); // Treat as wrong/forfeit
    };

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
                            <div
                                key={index}
                                className={optionClass}
                                onClick={() => !isSubmitted && setSelectedOption(index)}
                            >
                                {index + 1}. {option}
                            </div>
                        );
                    })}
                </div>

                {isSubmitted && (
                    <div className={styles.feedback}>
                        {selectedOption === question.correctIndex ? (
                            <div className={styles.successMessage}>正解！コマを配置します。</div>
                        ) : (
                            <div className={styles.errorMessage}>
                                不正解... <br />
                                <span className={styles.explanation}>{question.explanation}</span>
                                <button className={styles.closeButton} onClick={handleClose}>閉じる</button>
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
