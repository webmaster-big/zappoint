import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type TemplateField = 'subject' | 'body' | 'sms';

export const TEMPLATE_FIELD_LABELS: Record<TemplateField, string> = {
  subject: 'subject line',
  body: 'email body',
  sms: 'text message',
};

export const useTemplateFieldInsert = (bodyEditorRef: RefObject<HTMLDivElement | null>, onBodyChange: () => void) => {
  const [activeField, setActiveField] = useState<TemplateField>('body');
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    const track = () => {
      const editor = bodyEditorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
    };
    document.addEventListener('selectionchange', track);
    return () => document.removeEventListener('selectionchange', track);
  }, [bodyEditorRef]);

  const focusedField = (subject: HTMLElement | null, sms: HTMLElement | null): TemplateField | null => {
    const active = document.activeElement;
    const editor = bodyEditorRef.current;
    if (!active) return null;
    if (active === subject) return 'subject';
    if (active === sms) return 'sms';
    if (editor && (active === editor || editor.contains(active))) return 'body';
    return null;
  };

  const insertIntoBody = (command: 'insertText' | 'insertHTML', value: string) => {
    const editor = bodyEditorRef.current;
    if (!editor) return;
    const saved = savedRange.current;
    editor.focus();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      if (saved && editor.contains(saved.commonAncestorContainer)) {
        selection.addRange(saved);
      } else {
        const end = document.createRange();
        end.selectNodeContents(editor);
        end.collapse(false);
        selection.addRange(end);
      }
    }
    document.execCommand(command, false, value);
    onBodyChange();
  };

  const resetSelection = useCallback(() => {
    savedRange.current = null;
    const editor = bodyEditorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    if (editor.contains(selection.getRangeAt(0).commonAncestorContainer)) selection.removeAllRanges();
  }, [bodyEditorRef]);

  return { activeField, setActiveField, focusedField, insertIntoBody, resetSelection };
};
