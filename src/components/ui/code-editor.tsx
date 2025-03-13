
import React, { useRef } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
  placeholder?: string;
}

/**
 * A simple code editor component with syntax highlighting
 */
export function CodeEditor({
  value,
  onChange,
  language = 'javascript',
  height = '300px',
  placeholder = ''
}: CodeEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Handle change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  // Handle tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      // Insert 2 spaces for tab
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      
      // Move cursor position after the inserted spaces
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = start + 2;
          editorRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  return (
    <div className="code-editor-container relative border rounded-md overflow-hidden bg-gray-50 dark:bg-gray-900">
      <textarea
        ref={editorRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="font-mono text-sm w-full p-4 bg-transparent outline-none resize-none"
        style={{ 
          height, 
          caretColor: 'currentColor',
          lineHeight: '1.5rem'
        }}
        spellCheck={false}
      />
    </div>
  );
} 
