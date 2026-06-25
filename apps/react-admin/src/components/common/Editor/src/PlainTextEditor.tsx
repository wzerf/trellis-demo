import { useCallback, useEffect, useRef } from 'react';

export interface PlainTextEditorProps {
  value: string;
  height?: number | string;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  onReady?: () => void;
}

const PlainTextEditor: React.FC<PlainTextEditorProps> = ({
  value,
  height = '100%',
  disabled = false,
  placeholder,
  onChange,
  onReady,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editorHeight = typeof height === 'number' ? `${height}px` : height;

  const handleInput = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(event.target.value);
    },
    [onChange],
  );

  // Ready event: 使用 ref 跟踪最新 onReady，避免 prop 变化导致 effect 重跑
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });
  useEffect(() => {
    onReadyRef.current?.();
  }, []);

  return (
    <div className="plain-text-editor-container">
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        style={{ height: editorHeight }}
        className="plain-text-editor-textarea"
        onChange={handleInput}
      />
    </div>
  );
};

export default PlainTextEditor;
