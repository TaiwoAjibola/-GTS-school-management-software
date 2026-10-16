import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link2, Heading2 } from 'lucide-react'

/**
 * Lightweight, dependency-free WYSIWYG editor.
 * Outputs HTML (with inline styles) suitable for emails.
 * Uncontrolled: the DOM is the source of truth while typing; `value` is only
 * pushed into the DOM when it differs (e.g. when switching templates/formats),
 * which avoids clobbering the caret.
 */
export default function WysiwygEditor({
  value = '',
  onChange,
  tokens = [],
  className = '',
  placeholder = 'Write your content here…',
}) {
  const ref = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (el && value !== el.innerHTML) {
      el.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const emit = () => {
    if (onChange) onChange(ref.current.innerHTML)
  }

  const exec = (command, arg = null) => {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    emit()
  }

  const insertToken = (token) => {
    ref.current?.focus()
    document.execCommand('insertText', false, token)
    emit()
  }

  const addLink = () => {
    const url = window.prompt('Link URL (https://…)')
    if (!url) return
    ref.current?.focus()
    document.execCommand('createLink', false, url)
    emit()
  }

  const Btn = ({ title, onClick, children }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
    >
      {children}
    </button>
  )

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50">
        <Btn title="Bold" onClick={() => exec('bold')}><Bold size={15} /></Btn>
        <Btn title="Italic" onClick={() => exec('italic')}><Italic size={15} /></Btn>
        <Btn title="Underline" onClick={() => exec('underline')}><Underline size={15} /></Btn>
        <Btn title="Strikethrough" onClick={() => exec('strikeThrough')}><Strikethrough size={15} /></Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Btn title="Heading" onClick={() => exec('formatBlock', 'H2')}><Heading2 size={15} /></Btn>
        <Btn title="Bullet list" onClick={() => exec('insertUnorderedList')}><List size={15} /></Btn>
        <Btn title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered size={15} /></Btn>
        <Btn title="Insert link" onClick={addLink}><Link2 size={15} /></Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Btn title="Undo" onClick={() => exec('undo')}><span className="text-sm font-semibold">↶</span></Btn>
        <Btn title="Redo" onClick={() => exec('redo')}><span className="text-sm font-semibold">↷</span></Btn>
        {tokens.length > 0 && (
          <>
            <span className="w-px h-5 bg-slate-200 mx-1" />
            <span className="text-[10px] text-slate-400 px-1">Insert:</span>
            {tokens.map((t) => (
              <button
                key={t.token}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertToken(t.token)}
                title={t.label || t.token}
                className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 text-[11px] font-medium hover:bg-indigo-100"
              >
                {t.label || t.token}
              </button>
            ))}
          </>
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        className={`px-3 py-3 text-sm text-slate-800 leading-relaxed min-h-[200px] max-h-[360px] overflow-y-auto focus:outline-none ${className}`}
        style={{ wordBreak: 'break-word' }}
      />
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
        }
        [contenteditable] h2 { font-size: 1.25rem; font-weight: 700; margin: 0.4em 0; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 1.4em; margin: 0.4em 0; }
        [contenteditable] a { color: #4f46e5; text-decoration: underline; }
      `}</style>
    </div>
  )
}
