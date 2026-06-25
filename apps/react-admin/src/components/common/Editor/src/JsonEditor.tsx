import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isDarkMode } from './utils';

// We need to handle the CSS import separately
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('jsoneditor/dist/jsoneditor.min.css');
} catch {
  /* CSS may already be loaded */
}

export interface JsonEditorProps {
  value: string;
  height?: number | string;
  disabled?: boolean;
  placeholder?: string;
  options?: {
    mode?: 'code' | 'form' | 'text' | 'tree' | 'view';
    modes?: ('code' | 'form' | 'text' | 'tree' | 'view')[];
    search?: boolean;
  };
  onChange?: (value: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  height = 500,
  disabled = false,
  placeholder = '{}',
  options: propOptions,
  onChange,
  onReady,
}) => {
  const { mode = 'text', search = true } = propOptions || {};

  const [isDark, setIsDark] = useState(isDarkMode());
  const [parseError, setParseError] = useState('');
  const [jsonData, setJsonData] = useState<unknown>(() => {
    try {
      const parsed = JSON.parse(String(value));
      if (parsed !== null && typeof parsed === 'object') return parsed;
      if (parsed === null) return {};
      return { value: parsed };
    } catch {
      try {
        return JSON.parse(placeholder);
      } catch {
        return {};
      }
    }
  });
  const [lastExternalValue, setLastExternalValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // 当外部 value 变化时，同步到内部 jsonData（通过设置 lastExternalValue 触发）
  if (value !== lastExternalValue) {
    setLastExternalValue(value);
    const newData = (() => {
      try {
        const parsed = JSON.parse(String(value));
        if (parsed !== null && typeof parsed === 'object') return parsed;
        if (parsed === null) return {};
        return { value: parsed };
      } catch {
        try {
          return JSON.parse(placeholder);
        } catch {
          return {};
        }
      }
    })();
    setJsonData(newData);
  }

  // Calculate editor height
  const editorHeight = useMemo(() => {
    let baseHeight = 500;
    if (typeof height === 'number') {
      baseHeight = height;
    } else if (typeof height === 'string') {
      const numericHeight = Number(height);
      if (!Number.isNaN(numericHeight)) {
        baseHeight = numericHeight;
      } else if (height.endsWith('px')) {
        const pxValue = Number(height.replace('px', ''));
        if (!Number.isNaN(pxValue)) baseHeight = pxValue;
      } else {
        return height;
      }
    }
    return `${Math.max(baseHeight - 40, 200)}px`;
  }, [height]);

  // Handle editor content change
  const handleEditorChange = useCallback(
    (newValue: unknown) => {
      let serialized: string;
      let nextData: unknown;
      if (typeof newValue === 'string') {
        serialized = newValue;
        try {
          const parsed = JSON.parse(serialized);
          if (parsed !== null && typeof parsed === 'object') {
            nextData = parsed;
          } else if (parsed === null) {
            nextData = {};
          } else {
            nextData = { value: parsed };
          }
          setParseError('');
        } catch (error) {
          const err = error as Error;
          setParseError(err.message || 'Invalid JSON');
          nextData = jsonData;
        }
      } else if (Array.isArray(newValue) || (newValue !== null && typeof newValue === 'object')) {
        serialized = JSON.stringify(newValue, null, 2);
        nextData = newValue;
        setParseError('');
      } else {
        return;
      }
      setLastExternalValue(serialized);
      setJsonData(nextData);
      if (serialized !== value) {
        onChange?.(serialized);
      }
    },
    [onChange, jsonData, value],
  );

  // Dark mode tracking
  useEffect(() => {
    const checkDark = () => setIsDark(isDarkMode());
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // Ready event
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });
  useEffect(() => {
    onReadyRef.current?.();
  }, []);

  return (
    <div className={`json-editor-container${isDark ? ' json-editor-dark' : ''}`}>
      {parseError && <div className="error-message">{parseError}</div>}
      <div
        ref={containerRef}
        style={{ height: editorHeight, width: '100%' }}
        className="json-editor-core"
      >
        {/* json-editor-vue will be rendered here via imperative approach below */}
        <JsonJsonEditorFallback
          jsonData={jsonData}
          mode={mode}
          disabled={disabled}
          search={search}
          onChange={handleEditorChange}
          isDark={isDark}
        />
      </div>
    </div>
  );
};

/**
 * Fallback: use a simple textarea for JSON editing since json-editor-vue
 * requires Vue runtime. For a full-featured JSON editor in React,
 * consider using @monaco-editor/react or a dedicated React JSON editor.
 */
const JsonJsonEditorFallback: React.FC<{
  jsonData: unknown;
  mode: string;
  disabled: boolean;
  search: boolean;
  onChange: (value: unknown) => void;
  isDark: boolean;
}> = ({ jsonData, disabled, onChange, isDark }) => {
  const textFromData = useMemo(() => {
    try {
      return jsonData ? JSON.stringify(jsonData, null, 2) : '';
    } catch {
      return '';
    }
  }, [jsonData]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <textarea
      value={textFromData}
      disabled={disabled}
      onChange={handleChange}
      style={{
        width: '100%',
        height: '100%',
        padding: '8px',
        fontFamily: "Monaco, Consolas, 'Courier New', monospace",
        fontSize: '14px',
        lineHeight: 1.6,
        resize: 'none',
        border: 'none',
        outline: 'none',
        backgroundColor: isDark ? '#0f172a' : '#fff',
        color: isDark ? '#f1f5f9' : '#1f2937',
        boxSizing: 'border-box',
      }}
    />
  );
};

export default JsonEditor;
