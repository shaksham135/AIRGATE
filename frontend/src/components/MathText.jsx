import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { sanitizeLatexString } from '../utils/mathRenderer';

const KATEX_MACROS = {
  "\\tr": "\\operatorname{tr}",
  "\\det": "\\operatorname{det}",
  "\\gcd": "\\operatorname{gcd}",
  "\\lcm": "\\operatorname{lcm}",
  "\\rank": "\\operatorname{rank}",
  "\\mod": "\\operatorname{mod}",
  "\\deg": "\\operatorname{deg}",
  "\\Pr": "\\operatorname{Pr}",
  "\\E": "\\operatorname{E}",
  "\\Var": "\\operatorname{Var}",
  "\\lg": "\\operatorname{lg}"
};

/**
 * MathText — renders text containing LaTeX math expressions.
 * 
 * Supports:
 *   - Inline math:  $...$  or \(...\)
 *   - Display math: $$...$$ or \[...\]
 *   - Double-backslash escapes from AI JSON: \\mathit, \\frac, etc.
 * 
 * Usage:  <MathText text="If $Pe^x = Qe^{-x}$ for all real values of $x$" />
 */
export default function MathText({ text, className, style }) {
  const rendered = useMemo(() => {
    if (!text) return '';

    let normalized = sanitizeLatexString(text);

    // Split on math delimiters: $$...$$, $...$, \[...\], \(...\)
    // Process display math first ($$), then inline ($)
    const parts = [];
    let remaining = normalized;

    // Regex to match $$...$$ (display), $...$ (inline), \[...\] (display), \(...\) (inline)
    const mathRegex = /(\$\$[\s\S]*?\$\$|\$(?!\$)[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;

    let lastIndex = 0;
    let match;

    while ((match = mathRegex.exec(remaining)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: remaining.slice(lastIndex, match.index) });
      }

      const raw = match[1];
      let latex, displayMode;

      if (raw.startsWith('$$') && raw.endsWith('$$')) {
        latex = raw.slice(2, -2);
        displayMode = true;
      } else if (raw.startsWith('\\[') && raw.endsWith('\\]')) {
        latex = raw.slice(2, -2);
        displayMode = true;
      } else if (raw.startsWith('\\(') && raw.endsWith('\\)')) {
        latex = raw.slice(2, -2);
        displayMode = false;
      } else if (raw.startsWith('$') && raw.endsWith('$')) {
        latex = raw.slice(1, -1);
        displayMode = false;
      }

      parts.push({ type: 'math', content: latex, displayMode });
      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last match
    if (lastIndex < remaining.length) {
      parts.push({ type: 'text', content: remaining.slice(lastIndex) });
    }

    // If no math found, return original text
    if (parts.length === 0) {
      return normalized;
    }

    // Render parts to HTML
    return parts.map((part) => {
      if (part.type === 'text') {
        // Escape HTML entities in plain text
        return part.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      } else {
        try {
          return katex.renderToString(part.content, {
            displayMode: part.displayMode,
            throwOnError: false,
            trust: true,
            strict: false,
            output: 'html',
            macros: KATEX_MACROS
          });
        } catch (e) {
          // If KaTeX fails, return the raw LaTeX as text
          return `<code>${part.content}</code>`;
        }
      }
    }).join('');
  }, [text]);

  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
