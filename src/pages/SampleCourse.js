import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import GeometricGrid from '../components/GeometricGrid';
import { sampleEvent, generateSampleQuiz } from '../services/productService';
import './SampleCourse.css';

const EXAMPLES = ['Photosynthesis', 'The French Revolution', 'Supply and demand', "Newton's laws"];

export default function SampleCourse() {
  const [phase, setPhase] = useState('topic');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState('');
  const [answers, setAnswers] = useState([]);

  const current = questions[step];
  const checked = answers.length > step;
  const complete = phase === 'quiz' && step === questions.length;

  async function submitTopic(event) {
    event.preventDefault();
    const clean = topic.trim();
    if (!clean) return;
    setError('');
    setPhase('loading');
    try {
      const data = await generateSampleQuiz(clean);
      setTopic(clean);
      setQuestions(data.questions);
      setStep(0);
      setAnswers([]);
      setSelected('');
      setPhase('quiz');
      sampleEvent('sample_opened');
    } catch (err) {
      setError(err.message || 'Could not generate a sample. Try a different topic.');
      setPhase('topic');
    }
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (!selected || checked) return;
    setAnswers([...answers, selected]);
    sampleEvent('sample_answered');
    if (step === questions.length - 1) sampleEvent('sample_completed');
  }

  function reset() {
    setPhase('topic');
    setTopic('');
    setQuestions([]);
    setStep(0);
    setAnswers([]);
    setSelected('');
    setError('');
  }

  return (
    <div className="sc-root">
      <div className="sc-bg-fx" aria-hidden="true">
        <div className="sc-bg-wash" />
        <div className="sc-bg-orb sc-bg-orb-1" />
        <div className="sc-bg-orb sc-bg-orb-2" />
        <GeometricGrid className="sc-bg-geo" linesClassName="sc-bg-geo-lines" numsClassName="sc-bg-geo-nums" />
        <div className="sc-bg-grain" />
        <div className="sc-bg-vignette" />
      </div>

      <header className="sc-header">
        <Link className="sc-back" to="/"><ChevronLeft size={16} aria-hidden="true" />Back</Link>
        <span className="sc-tag">Free sample &middot; No account needed</span>
      </header>

      <main className="sc-main">
        {phase === 'topic' && (
          <section className="sc-step">
            <div className="sc-index">01</div>
            <h1 className="sc-title">Pick anything you&rsquo;re studying.</h1>
            <p className="sc-sub">Type a subject or topic. Cerbyl writes two practice questions on it, on the spot, no signup required.</p>
            <form className="sc-form" onSubmit={submitTopic}>
              <label className="sc-label" htmlFor="sc-topic">Topic</label>
              <input
                id="sc-topic"
                className="sc-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Cellular respiration"
                autoFocus
                autoComplete="off"
              />
              {error && <p className="sc-error" role="alert">{error}</p>}
              <button className="sc-btn sc-btn-primary" type="submit" disabled={!topic.trim()}>Generate my sample</button>
            </form>
            <div className="sc-examples">
              <span className="sc-examples-label">Try</span>
              {EXAMPLES.map((example) => (
                <button key={example} type="button" className="sc-example" onClick={() => setTopic(example)}>{example}</button>
              ))}
            </div>
          </section>
        )}

        {phase === 'loading' && (
          <section className="sc-step">
            <div className="sc-index">01</div>
            <h1 className="sc-title">Writing your sample on {topic}.</h1>
            <div className="sc-loading-bar" role="status" aria-label="Generating"><span /></div>
          </section>
        )}

        {phase === 'quiz' && !complete && current && (
          <section className="sc-step">
            <div className="sc-index">{String(step + 2).padStart(2, '0')}</div>
            <div className="sc-meta">Question {step + 1} of {questions.length} &middot; {topic}</div>
            <h1 className="sc-question">{current.question}</h1>
            <form onSubmit={submitAnswer}>
              <fieldset className="sc-options" disabled={checked}>
                <legend className="sr-only">Answer options</legend>
                {current.options.map((option, i) => (
                  <label className="sc-option" key={option}>
                    <span className="sc-option-index" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                    <span>{option}</span>
                    <input type="radio" name="answer" value={option} checked={selected === option} onChange={() => setSelected(option)} />
                  </label>
                ))}
              </fieldset>
              {!checked && <button className="sc-btn sc-btn-primary" disabled={!selected}>Check my answer</button>}
            </form>
            {checked && (
              <div className="sc-feedback" role="status">
                <strong className={selected === current.correct ? 'sc-good' : 'sc-bad'}>
                  {selected === current.correct ? 'Correct.' : `The answer is ${current.correct}.`}
                </strong>
                <p>{current.explanation}</p>
                <button className="sc-btn sc-btn-primary" onClick={() => { setStep(step + 1); setSelected(''); }}>
                  {step === questions.length - 1 ? 'See my results' : 'Next question'}
                </button>
              </div>
            )}
          </section>
        )}

        {complete && (
          <section className="sc-step">
            <div className="sc-index">{String(questions.length + 2).padStart(2, '0')}</div>
            <div className="sc-meta">Results &middot; {topic}</div>
            <h1 className="sc-title">{answers.filter((a, i) => a === questions[i].correct).length} of {questions.length} correct</h1>
            <p className="sc-sub">Two questions on one topic are a starting point, not proof of mastery. Create your workspace to practise this and every other subject, with a tutor that remembers your weak spots.</p>
            <div className="sc-actions">
              <Link className="sc-btn sc-btn-primary" to="/register">Create my workspace</Link>
              <button className="sc-btn sc-btn-ghost" type="button" onClick={reset}>Try another topic</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
