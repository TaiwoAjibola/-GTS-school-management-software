import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Styled replacements for window.confirm / window.prompt.
 *
 * const { confirm, prompt, host } = useDialog()
 * // render {host} once per page/component
 * // if (!(await confirm('Delete this plan?'))) return
 * // const name = await prompt('Name this format:', { title: 'Save format' })
 */

function DialogHost({ state, onResolve }) {
  const [value, setValue] = useState(state.kind === 'prompt' ? state.initial : '')
  const inputRef = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (state.kind === 'prompt' && inputRef.current) {
      const el = inputRef.current
      el.focus()
      try { el.setSelectionRange(el.value.length, el.value.length) } catch { /* non-input types */ }
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onResolve(state.kind === 'prompt' ? null : false)
      }
      if (e.key === 'Enter' && state.kind === 'confirm') {
        e.preventDefault()
        onResolve(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resolve = (result) => {
    if (doneRef.current) return
    doneRef.current = true
    onResolve(result)
  }

  const primaryClasses = state.tone === 'danger'
    ? 'bg-rose-600 text-white hover:bg-rose-700'
    : 'bg-[#4F46E5] text-white hover:bg-[#4338ca]'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) resolve(state.kind === 'prompt' ? null : false) }}
      role="dialog"
      aria-modal="true"
      aria-label={state.title || 'Dialog'}
    >
      <div className="w-[92vw] sm:w-full sm:max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 leading-tight">{state.title || (state.kind === 'prompt' ? 'Input' : 'Are you sure?')}</h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{state.message}</p>

        {state.kind === 'prompt' ? (
          <form
            onSubmit={(e) => { e.preventDefault(); resolve(value.trim() === '' && state.allowEmpty ? '' : value) }}
            className="mt-4"
          >
            <input
              ref={inputRef}
              type={state.inputType || 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={state.placeholder || ''}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#4F46E5] transition-colors"
              autoComplete="off"
            />
            {state.hint ? <p className="text-[11px] text-slate-400 mt-1.5">{state.hint}</p> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => resolve(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] transition-all ${primaryClasses}`}
              >
                {state.confirmLabel || 'OK'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => resolve(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all min-h-[42px]"
            >
              {state.cancelLabel || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => resolve(true)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] transition-all min-h-[42px] ${primaryClasses}`}
            >
              {state.confirmLabel || 'Confirm'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function useDialog() {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)

  const resolveWith = useCallback((value) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setState(null)
    resolve?.(value)
  }, [])

  const ask = useCallback((kind, message, options) => {
    return new Promise((resolve) => {
      if (resolverRef.current) resolverRef.current(kind === 'prompt' ? null : false)
      resolverRef.current = resolve
      setState({ kind, message, ...options })
    })
  }, [])

  const confirm = useCallback((message, options = {}) =>
    ask('confirm', message, {
      title: options.title || 'Are you sure?',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      tone: options.tone || 'danger',
    }), [ask])

  const prompt = useCallback((message, options = {}) =>
    ask('prompt', message, {
      title: options.title || 'Input',
      confirmLabel: options.confirmLabel || 'OK',
      tone: options.tone || 'primary',
      initial: options.initial || '',
      placeholder: options.placeholder || '',
      inputType: options.type || 'text',
      hint: options.hint || null,
    }), [ask])

  const host = state
    ? <DialogHost key={state.kind + ':' + state.message} state={state} onResolve={resolveWith} />
    : null

  return { confirm, prompt, host }
}
