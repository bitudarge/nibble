import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuizProgress } from './QuizProgress'

describe('QuizProgress', () => {
  it('shows the current step out of the total', () => {
    render(<QuizProgress step={3} total={6} />)
    expect(screen.getByText('Question 3 of 6')).toBeInTheDocument()
  })

  it('sizes the progress bar fill to the step fraction', () => {
    render(<QuizProgress step={3} total={6} />)
    expect(screen.getByTestId('quiz-progress-fill')).toHaveStyle({ width: '50%' })
  })
})
