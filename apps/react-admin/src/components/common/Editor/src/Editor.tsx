import { lazy, Suspense, useMemo } from 'react';

import { EditorTypes } from '../types';
import type { EditorProps } from '../types';

const LazyTiptapEditor = lazy(() => import('./TiptapEditor'));
const LazyMarkdownEditor = lazy(() => import('./MarkdownEditor'));
const LazyJsonEditor = lazy(() => import('./JsonEditor'));
const LazyPlainTextEditor = lazy(() => import('./PlainTextEditor'));
const LazyCodeEditor = lazy(() => import('./CodeEditor'));

const Editor: React.FC<EditorProps> = ({
  value,
  editorType = EditorTypes.MARKDOWN,
  height = '100%',
  disabled = false,
  placeholder,
  uploadImage,
  markdownOptions,
  jsonOptions,
  codeOptions,
  onChange,
  onReady,
}) => {
  const currentEditorComponent = useMemo(() => {
    switch (editorType) {
      case EditorTypes.CODE:
      case EditorTypes.VISUAL_BUILDER:
        return LazyCodeEditor;
      case EditorTypes.JSON:
        return LazyJsonEditor;
      case EditorTypes.MARKDOWN:
        return LazyMarkdownEditor;
      case EditorTypes.PLAIN_TEXT:
        return LazyPlainTextEditor;
      case EditorTypes.RICH_TEXT:
        return LazyTiptapEditor;
      default:
        return LazyMarkdownEditor;
    }
  }, [editorType]);

  const currentOptions = useMemo(() => {
    switch (editorType) {
      case EditorTypes.CODE:
        return codeOptions;
      case EditorTypes.JSON:
        return jsonOptions;
      case EditorTypes.MARKDOWN:
        return markdownOptions;
      default:
        return undefined;
    }
  }, [editorType, codeOptions, jsonOptions, markdownOptions]);

  const EditorComponent = currentEditorComponent;

  return (
    <div className="editor-container">
      <Suspense fallback={<div style={{ padding: 16, textAlign: 'center', color: '#999' }}>Loading editor...</div>}>
        <EditorComponent
          value={value}
          height={height}
          disabled={disabled}
          placeholder={placeholder}
          uploadImage={uploadImage}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          options={currentOptions as any}
          onChange={onChange}
          onReady={onReady}
        />
      </Suspense>
    </div>
  );
};

export default Editor;
