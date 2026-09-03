/** A gentle "Question X of Y" indicator with a soft progress bar. */
export function QuizProgress({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100)
  return (
    <div className="mb-5">
      <div className="mb-1.5 font-sans text-xs font-bold text-muted">
        Question {step} of {total}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          data-testid="quiz-progress-fill"
          className="h-full rounded-full bg-sage transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
