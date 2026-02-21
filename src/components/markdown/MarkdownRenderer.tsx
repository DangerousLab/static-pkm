/**
 * Markdown Renderer Component
 * Renders sanitized markdown HTML with semantic CSS styling.
 *
 * @module MarkdownRenderer
 */

import { useMemo } from 'react';
import { parseBasicMarkdown } from '@core/utils/markdownParser';

interface MarkdownRendererProps {
  /** Raw markdown content to render */
  content: string;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * MarkdownRenderer
 *
 * Parses markdown once per content change (useMemo), then renders
 * sanitized HTML via dangerouslySetInnerHTML. DOMPurify in
 * parseBasicMarkdown ensures XSS safety.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
}) => {
  const html = useMemo(() => {
    console.log('[DEBUG] [MarkdownRenderer] Parsing markdown content');
    return parseBasicMarkdown(content);
  }, [content]);

  return (
    <div
      className={`markdown-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownRenderer;
