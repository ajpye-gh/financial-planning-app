import { useState } from 'react';
import { visibleQuestions, type Answers } from '../../lib/questions';

interface QuestionnaireWizardProps {
  answers: Answers;
  onAnswer: (id: string, value: boolean | string) => void;
  onComplete: () => void;
}

export function QuestionnaireWizard({ answers, onAnswer, onComplete }: Readonly<QuestionnaireWizardProps>) {
  const [step, setStep] = useState(0);
  const questions = visibleQuestions(answers);
  const question = questions[step];

  const choose = (value: boolean | string) => {
    onAnswer(question.id, value);
    if (step + 1 < visibleQuestions({ ...answers, [question.id]: value }).length) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="questionnaire">
      <div className="questionnaire__progress">
        Question {step + 1} of {questions.length}
      </div>
      <h2 className="questionnaire__prompt">{question.prompt}</h2>
      <div className="questionnaire__options">
        {question.type === 'boolean' ? (
          <>
            <button type="button" className="questionnaire__option primary" onClick={() => choose(true)}>
              Yes
            </button>
            <button type="button" className="questionnaire__option" onClick={() => choose(false)}>
              No
            </button>
          </>
        ) : (
          question.options?.map((option) => (
            <button
              key={option.value}
              type="button"
              className="questionnaire__option primary"
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))
        )}
      </div>
      {step > 0 && (
        <div className="questionnaire__nav">
          <button type="button" onClick={() => setStep(step - 1)}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}
