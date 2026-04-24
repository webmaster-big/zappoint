// src/components/admin/email/HtmlCodeEditor.tsx
import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { search, searchKeymap } from '@codemirror/search';
import { EditorView, keymap } from '@codemirror/view';

interface HtmlCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  minHeight?: string;
  readOnly?: boolean;
  placeholder?: string;
}

/**
 * HTML/code editor used for editing email notification bodies.
 * Powered by CodeMirror 6 with HTML syntax highlighting, word wrap,
 * and built-in find/replace (Ctrl/Cmd+F).
 */
const HtmlCodeEditor: React.FC<HtmlCodeEditorProps> = ({
  value,
  onChange,
  height = '500px',
  minHeight,
  readOnly = false,
  placeholder,
}) => {
  const extensions = useMemo(
    () => [
      html({ matchClosingTags: true, autoCloseTags: true }),
      EditorView.lineWrapping,
      search({ top: true }),
      keymap.of(searchKeymap),
    ],
    []
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <CodeMirror
        value={value}
        height={height}
        minHeight={minHeight}
        readOnly={readOnly}
        placeholder={placeholder}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          searchKeymap: false,
        }}
      />
    </div>
  );
};

export default HtmlCodeEditor;
