import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProgressControl } from './ProgressControl'

describe('ProgressControl', () => {
  it('renders a range slider when the page count is known, and commits on release', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ProgressControl currentPage={50} pageCount={200} onSave={onSave} />)

    const slider = screen.getByLabelText('Your page in this book')
    fireEvent.change(slider, { target: { value: '80' } })
    // onSave shouldn't fire from onChange alone, only on release, otherwise
    // dragging would fire a save per pixel of movement.
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.pointerUp(slider)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(80))
  })

  it('does not call onSave when released without actually changing the value', () => {
    const onSave = vi.fn()
    render(<ProgressControl currentPage={50} pageCount={200} onSave={onSave} />)
    fireEvent.pointerUp(screen.getByLabelText('Your page in this book'))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('falls back to a number field with an explicit Save button when the page count is unknown', () => {
    const onSave = vi.fn()
    render(<ProgressControl currentPage={12} pageCount={null} onSave={onSave} />)
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()

    const input = screen.getByLabelText('Your page in this book')
    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(30)
  })

  it('rolls back to the previous value and shows an error if the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network down'))
    render(<ProgressControl currentPage={50} pageCount={200} onSave={onSave} />)

    const slider = screen.getByLabelText('Your page in this book')
    fireEvent.change(slider, { target: { value: '80' } })
    fireEvent.pointerUp(slider)

    await waitFor(() => expect(screen.getByText('network down')).toBeInTheDocument())
    expect(slider).toHaveValue('50')
  })
})
