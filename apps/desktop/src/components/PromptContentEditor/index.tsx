import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type React from 'react'

import { cn } from '@/lib/utils'

export type PromptContentEditorSuggestion = {
  key: string
  label: string
  type: 'text' | 'image'
}

type PromptContentEditorProps = {
  autoFocus?: boolean
  className?: string
  placeholder?: string
  suggestions: PromptContentEditorSuggestion[]
  value: string
  onChange: (value: string) => void
}

type SuggestionMenuState = {
  caretOffset: number
  left: number
  query: string
  top: number
  triggerOffset: number
}

export function PromptContentEditor({
  autoFocus,
  className,
  placeholder,
  suggestions,
  value,
  onChange,
}: PromptContentEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [menuState, setMenuState] = useState<SuggestionMenuState | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const filteredSuggestions = useMemo(() => {
    if (!menuState) {
      return []
    }

    const query = menuState.query.toLowerCase()
    const matchedSuggestions = suggestions.filter((suggestion) => {
      return suggestion.key.toLowerCase().includes(query) || suggestion.label.toLowerCase().includes(query)
    })

    return matchedSuggestions.slice(0, 6)
  }, [menuState, suggestions])

  useEffect(() => {
    const editor = editorRef.current

    if (!editor || document.activeElement === editor || getEditorText(editor) === value) {
      return
    }

    editor.innerText = value
  }, [value])

  useEffect(() => {
    if (!autoFocus) {
      return
    }

    editorRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    setActiveIndex(0)
  }, [menuState?.query])

  function syncValueFromEditor() {
    const editor = editorRef.current

    if (!editor) {
      return
    }

    const nextValue = getEditorText(editor)
    onChange(nextValue)
    updateSuggestionMenu(nextValue)
  }

  function updateSuggestionMenu(nextValue = value) {
    const editor = editorRef.current
    const wrapper = wrapperRef.current

    if (!editor || !wrapper) {
      setMenuState(null)
      return
    }

    const caretOffset = getCaretTextOffset(editor)

    if (caretOffset === null) {
      setMenuState(null)
      return
    }

    const beforeCaret = nextValue.slice(0, caretOffset)
    const triggerOffset = beforeCaret.lastIndexOf('{{')
    const lastClosedOffset = beforeCaret.lastIndexOf('}}')

    if (triggerOffset === -1 || lastClosedOffset > triggerOffset) {
      setMenuState(null)
      return
    }

    const query = beforeCaret.slice(triggerOffset + 2)

    if (!/^[A-Za-z0-9_]*$/.test(query)) {
      setMenuState(null)
      return
    }

    const position = getCaretPosition(wrapper)

    if (!position) {
      setMenuState(null)
      return
    }

    setMenuState({
      caretOffset,
      left: position.left,
      query,
      top: position.top,
      triggerOffset,
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!menuState || filteredSuggestions.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((currentIndex) => (currentIndex + 1) % filteredSuggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((currentIndex) => (currentIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length)
      return
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      insertSuggestion(filteredSuggestions[activeIndex])
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setMenuState(null)
    }
  }

  function insertSuggestion(suggestion: PromptContentEditorSuggestion) {
    const editor = editorRef.current

    if (!editor || !menuState) {
      return
    }

    const currentText = getEditorText(editor)
    const replacement = `{{${suggestion.key}}}`
    const nextValue = `${currentText.slice(0, menuState.triggerOffset)}${replacement}${currentText.slice(menuState.caretOffset)}`
    const nextCaretOffset = menuState.triggerOffset + replacement.length

    editor.innerText = nextValue
    onChange(nextValue)
    setMenuState(null)

    requestAnimationFrame(() => {
      editor.focus()
      setCaretTextOffset(editor, nextCaretOffset)
    })
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative min-h-[42vh] w-full rounded-lg border border-border bg-fill transition-colors focus-within:border-border-hover',
        className,
      )}
    >
      <pre
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 whitespace-pre-wrap px-4 py-3 font-sans text-base leading-6 text-text-strong"
      >
        {renderHighlightedPrompt(value)}
      </pre>
      <div
        ref={editorRef}
        className={cn(
          'art-pilot-scrollbar relative z-10 min-h-[42vh] w-full overflow-y-auto whitespace-pre-wrap px-4 py-3 font-sans text-base leading-6 text-transparent caret-text-strong outline-none empty:before:text-text-muted empty:before:content-[attr(data-placeholder)]',
        )}
        contentEditable="plaintext-only"
        data-placeholder={placeholder}
        role="textbox"
        spellCheck={false}
        tabIndex={0}
        onBlur={() => setMenuState(null)}
        onInput={syncValueFromEditor}
        onKeyDown={handleKeyDown}
        onKeyUp={() => updateSuggestionMenu(getEditorText(editorRef.current))}
        onMouseUp={() => updateSuggestionMenu(getEditorText(editorRef.current))}
        onPaste={(event) => {
          event.preventDefault()
          insertPlainText(event.clipboardData.getData('text/plain'))
          syncValueFromEditor()
        }}
      />

      {menuState && filteredSuggestions.length > 0 ? (
        <div
          className="absolute z-20 w-80 overflow-hidden rounded-lg border border-border bg-background-solid p-1"
          style={{
            left: menuState.left,
            top: menuState.top,
          }}
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              className={cn(
                'flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-base font-semibold transition-colors',
                index === activeIndex ? 'bg-fill-hover text-text-strong' : 'text-text-muted hover:bg-fill-hover hover:text-text-strong',
              )}
              key={suggestion.key}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                insertSuggestion(suggestion)
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="text-accent">{'{x}'}</span>
              <span className="min-w-0 flex-1 truncate">{suggestion.label}</span>
              <span className="shrink-0 text-text-muted">{suggestion.type}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function renderHighlightedPrompt(value: string) {
  if (!value) {
    return null
  }

  const nodes: React.ReactNode[] = []
  const variablePattern = /\{\{\s*[A-Za-z][A-Za-z0-9_]*\s*\}\}/g
  let lastIndex = 0

  for (const match of value.matchAll(variablePattern)) {
    const matchIndex = match.index ?? 0

    if (matchIndex > lastIndex) {
      nodes.push(value.slice(lastIndex, matchIndex))
    }

    nodes.push(
      <span className="text-accent" key={`${match[0]}-${matchIndex}`}>
        {match[0]}
      </span>,
    )
    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex))
  }

  return nodes
}

function getEditorText(editor: HTMLDivElement | null) {
  return editor?.innerText.replace(/\n$/, '') ?? ''
}

function getCaretTextOffset(root: HTMLElement) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)

  if (!root.contains(range.endContainer)) {
    return null
  }

  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(root)
  preCaretRange.setEnd(range.endContainer, range.endOffset)

  return preCaretRange.toString().length
}

function setCaretTextOffset(root: HTMLElement, offset: number) {
  const range = document.createRange()
  const selection = window.getSelection()
  let remainingOffset = offset

  function visit(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length ?? 0

      if (remainingOffset <= textLength) {
        range.setStart(node, remainingOffset)
        range.collapse(true)
        return true
      }

      remainingOffset -= textLength
      return false
    }

    for (const childNode of node.childNodes) {
      if (visit(childNode)) {
        return true
      }
    }

    return false
  }

  if (!visit(root)) {
    range.selectNodeContents(root)
    range.collapse(false)
  }

  selection?.removeAllRanges()
  selection?.addRange(range)
}

function getCaretPosition(wrapper: HTMLElement) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0).cloneRange()
  range.collapse(false)

  const wrapperRect = wrapper.getBoundingClientRect()
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()

  if (!rect) {
    return {
      left: 0,
      top: 32,
    }
  }

  return {
    left: Math.max(0, Math.min(rect.left - wrapperRect.left, wrapperRect.width - 320)),
    top: rect.bottom - wrapperRect.top + 6,
  }
}

function insertPlainText(text: string) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return
  }

  selection.deleteFromDocument()
  selection.getRangeAt(0).insertNode(document.createTextNode(text))
  selection.collapseToEnd()
}
