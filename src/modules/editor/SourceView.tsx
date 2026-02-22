/**
 * SourceView
 * Raw markdown textarea — no rendering, full control over syntax.
 *
 * @module SourceView
 */

interface SourceViewProps {
  content: string;
  onChange: (content: string) => void;
  scrollRef?: React.RefObject<HTMLTextAreaElement | null>;
  wrapperRef?: React.RefObject<HTMLDivElement | null>;
}

export const SourceView: React.FC<SourceViewProps> = ({ content, onChange, scrollRef, wrapperRef }) => {
  return (
    <div ref={wrapperRef} className="editor-source-view">
      <textarea
        ref={scrollRef}
        className="editor-source-textarea"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="Raw markdown source"
      />
    </div>
  );
};
