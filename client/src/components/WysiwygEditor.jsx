import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link2, Heading2, Image as ImageIcon, Upload } from 'lucide-react'
import apiClient from '../api/client'

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
  const fileRef = useRef(null)
  const [imgOpen, setImgOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const logoUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/logo.svg`

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

  const insertHtml = (html) => {
    ref.current?.focus()
    document.execCommand('insertHTML', false, html)
    emit()
  }

  const insertLogo = () => {
    insertHtml(`<img src="${logoUrl}" alt="Logo" style="max-height:64px;width:auto;display:inline-block;" />`)
    setImgOpen(false)
  }

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiClient.post('/images/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      insertHtml(`<img src="${res.data.url}" alt="${file.name}" style="max-width:100%;height:auto;display:inline-block;" />`)
      setImgOpen(false)
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Image upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const insertByUrl = () => {
    const url = window.prompt('Image URL (https://…)')
    if (!url) return
    insertHtml(`<img src="${url}" alt="" style="max-width:100%;height:auto;display:inline-block;" />`)
    setImgOpen(false)
  }

  const Btn = ({ title, onClick, children, active }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
        active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50 relative">
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
        <Btn title="Insert app logo" onClick={insertLogo}><span className="text-[10px] font-bold">LOGO</span></Btn>
        <div className="relative">
          <Btn title="Insert image" onClick={() => setImgOpen((v) => !v)} active={imgOpen}><ImageIcon size={15} /></Btn>
          {imgOpen && (
            <div
              className="absolute left-0 top-9 z-20 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-3 space-y-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="text-[11px] font-semibold text-slate-500">Insert an image</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#4F46E5] text-white text-xs font-medium px-3 py-2 hover:bg-[#4338ca] disabled:opacity-60"
              >
                <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload from device'}
              </button>
              <button
                type="button"
                onClick={insertByUrl}
                className="w-full rounded-lg border border-slate-200 text-slate-700 text-xs font-medium px-3 py-2 hover:bg-slate-50"
              >
                Insert by URL
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
            </div>
          )}
        </div>
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
        [contenteditable] img { max-width: 100%; }
      `}</style>
    </div>
  )
}
