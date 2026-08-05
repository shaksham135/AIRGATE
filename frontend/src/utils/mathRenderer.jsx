import React, { useEffect, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import API_CONFIG from '../config/api';

mermaid.initialize({ startOnLoad: false, theme: 'dark', suppressErrorRendering: true });

function MermaidBlock({ chart }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      if (!chart) return;

      // Auto-correct common LLM Mermaid syntax quirks:
      // 1. Fix "|label|>" -> "|label|" (e.g., -->|2x + 3y = 240|> B[120,0])
      // 2. Fix unescaped arrows in label string
      let sanitizedChart = chart
        .replace(/\|([^|]+)\|>/g, '|$1|')
        .replace(/-->\|([^|]+)\|>/g, '-->|$1|');

      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        const { svg: renderedSvg } = await mermaid.render(id, sanitizedChart);
        if (isMounted) setSvg(renderedSvg);
      } catch (err) {
        if (isMounted) {
          const safeCode = chart.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          setSvg(`
            <div style="padding:12px; border:1px dashed var(--border-color, #444); border-radius:6px; color:var(--text-muted, #aaa); font-size:13px; text-align:left; width:100%;">
              <div style="font-weight:600; margin-bottom:6px; color:#e5c07b;">📊 Diagram Code</div>
              <pre style="margin:0; white-space:pre-wrap; font-family:monospace; font-size:12px;">${safeCode}</pre>
            </div>
          `);
        }
      }
    };
    renderChart();
    return () => { isMounted = false; };
  }, [chart]);

  if (!svg) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Rendering diagram...</div>;
  }

  return (
    <div 
      style={{ 
        background: 'rgba(0,0,0,0.2)', 
        padding: '16px', 
        borderRadius: '8px', 
        margin: '12px 0',
        display: 'flex',
        justifyContent: 'center',
        overflowX: 'auto'
      }} 
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};

export const getAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.BASE_URL}${cleanPath}`;
};

/**
 * Industry-Standard LaTeX Parser & Sanitizer
 * Used by top platforms (LeetCode, ChatGPT, StackExchange)
 * - Safely normalizes JSON string escapes (\\frac -> \frac)
 * - Auto-encloses unwrapped LaTeX blocks (\frac, \begin{bmatrix})
 * - Preserves native KaTeX math formatting & layout without breaking line breaks or causing page overflow
 */
const latexSanitizeCache = new Map();
const MAX_LATEX_CACHE_SIZE = 500;

export const sanitizeLatexString = (str) => {
  if (!str) return '';

  const key = String(str);
  if (latexSanitizeCache.has(key)) {
    return latexSanitizeCache.get(key);
  }

  let s = key;

  // 0a. Repair JSON control character escapes (\f -> formfeed \u000C, \t -> tab \u0009, \r -> \u000D, \b -> \u0008)
  s = s.replace(/\u000Crac/gi, '\\frac')
       .replace(/\u0009imes/gi, '\\times')
       .replace(/\u000Dight/gi, '\\right')
       .replace(/\u0008egin/gi, '\\begin');

  // 0b. Auto-repair stripped backslashes from AI JSON string escaping quirks
  // e.g., rac{a}{b} -> \frac{a}{b}, rac12 -> \frac{1}{2}, 2imes2 -> 2\times 2, Pleft( -> P\left(, ight)^n -> \right)^n
  s = s.replace(/(?<![a-zA-Z\\])rac\{([^{}]+|\{[^{}]*\})\}\{([^{}]+|\{[^{}]*\})\}/gi, '\\frac{$1}{$2}')
       .replace(/(?<![a-zA-Z\\])rac\s*([0-9])\s*([0-9])/gi, '\\frac{$1}{$2}')
       .replace(/(?<![a-zA-Z\\])imes(?![a-zA-Z])/gi, ' \\times ')
       .replace(/(?<![a-zA-Z\\])left\(/gi, '\\left(')
       .replace(/(?<![a-zA-Z\\])ight\)/gi, '\\right)')
       .replace(/(?<![a-zA-Z\\])egin\{(bmatrix|matrix|pmatrix|vmatrix|aligned)\}/gi, '\\begin{$1}')
       .replace(/(?<![a-zA-Z\\])end(bmatrix|matrix|pmatrix|vmatrix|aligned)/gi, '\\end{$1}')
       .replace(/(?<![a-zA-Z\\])\b(S|A|B|C|X|Y)rightarrow(epsilon|[a-zA-Z0-9]+)?/gi, (m, p1, p2) => {
          return `${p1} \\rightarrow ${p2 === 'epsilon' ? '\\epsilon' : (p2 || '')}`;
       })
       .replace(/(?<![a-zA-Z\\])\b(Sigma|lambda|alpha|beta|gamma|delta|epsilon|theta|pi|sigma|omega)\b/g, '\\$1');

  // 0c. Auto-decode escaped Unicode sequences from OCR output (e.g. \u2212 -> -, \u221a2 -> \sqrt{2}, \u00d7 -> \times)
  s = s.replace(/\\u2212/gi, '-')
       .replace(/\\u221a([0-9a-zA-Z]+|\{[^{}]+\})/gi, '\\sqrt{$1}')
       .replace(/\\u221a/gi, '\\sqrt{}')
       .replace(/\\u00d7/gi, '\\times ')
       .replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => {
         try {
           return String.fromCharCode(parseInt(hex, 16));
         } catch (e) {
           return m;
         }
       });

  // 1. Repair matrix environments where backslashes were stripped by JSON parsing
  // e.g. \begin{bmatrix}2&0&0\0&3&0\0&0&4\end{bmatrix} -> \begin{bmatrix}2&0&0 \\ 0&3&0 \\ 0&0&4 \end{bmatrix}
  s = s.replace(/\\begin\{(bmatrix|matrix|pmatrix|vmatrix|aligned)\}([\s\S]*?)\\end\{\1\}/gi, (match, env, content) => {
    let clean = content;
    clean = clean.replace(/([0-9a-zA-Z\)\}])\s*\\(?=[0-9a-zA-Z\-\+\(\{])/g, '$1 \\\\ ');
    clean = clean.replace(/&\s*\\(?=[0-9a-zA-Z])/g, '& ');
    return `\\begin{${env}}${clean}\\end{${env}}`;
  });

  // 1b. Auto-wrap unwrapped \begin{matrix}... if NOT inside $ or $$
  s = s.replace(/(?<!\$)\\begin\{(bmatrix|matrix|pmatrix|vmatrix|aligned)\}([\s\S]*?)\\end\{\1\}(?!\$)/gi, ' $$ \\begin{$1}$2\\end{$1} $$ ');

  // 2. Convert \[ ... \] to $$ ... $$ and \( ... \) to $ ... $
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, ' $$ $1 $$ ');
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, ' $ $1 $ ');

  // 3. Auto-wrap unwrapped \frac{...}{...} and \sqrt{...} if not enclosed in $
  s = s.replace(/(?<!\$)\\frac\{([^{}]+|\{[^{}]*\})\}\{([^{}]+|\{[^{}]*\})\}(?!\$)/gi, ' $\\frac{$1}{$2}$ ');
  s = s.replace(/(?<!\$)([-+]?[0-9]*\.?[0-9]*\s*\\sqrt\{[^{}]+\})(?!\$)/gi, (m, p1) => ` $${p1}$ `);

  // 4. Fix stashed words & commands (e.g. cdot(-1) -> \cdot (-1), det(A) -> \det(A))
  s = s.replace(/\bcdot([^\s])/g, ' \\cdot $1');
  s = s.replace(/andtheminor/gi, ' and the minor ');

  // 4b. Auto-repair dollar signs that accidentally wrap English sentences/phrases (e.g. $...and require...units of processing time...$)
  s = s.replace(/\$(?!\$)([\s\S]*?)\$/g, (fullMatch, content) => {
    if (/\b(and require|units of processing time|respectively|given that|is calculated as|completion time|arrival time|where|what is|is true for|because)\b/i.test(content)) {
      let repaired = content.replace(/\b(and require|units of processing time|respectively|given that|is calculated as|completion time|arrival time|where|what is|is true for|because)\b/gi, ' $1 ');
      repaired = repaired.replace(/(?<!\$)\b([a-zA-Z]_[0-9a-zA-Z{}]+|[a-zA-Z]\^\{[^}]+\}|\\forall\s*[a-zA-Z]|\\exists\s*[a-zA-Z])(?!\$)/g, (m, p1) => ` $${p1}$ `);
      return repaired;
    }
    return fullMatch;
  });

  // 5. Split string into already-wrapped math vs plain text segments
  const dollarRegex = /(\$\$[\s\S]*?\$\$|\$(?!\$)(?:[^$\\]|\\.){1,300}?\$)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = dollarRegex.exec(s)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: s.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'math', value: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < s.length) {
    parts.push({ type: 'text', value: s.slice(lastIndex) });
  }

  // 6. Auto-wrap unwrapped LaTeX math tokens in plain text parts
  s = parts.map(part => {
    if (part.type === 'math') return part.value;
    let t = part.value;

    // Match LaTeX expressions like \lambda_1^2 = 4, \sum_{i=1}^{3} \lambda_i, v_1 = [1 0 0]
    t = t.replace(/(?<!\$)(\\?(?:lambda|alpha|beta|gamma|delta|epsilon|theta|pi|sigma|omega|sum|prod|int|det|tr|a_|b_|M_|v_|\b[a-zA-Z]\b_\d+)(?:[^\$\n,;]+)?)(?!\$)/gi, (token) => {
      let trimmed = token.trim();
      if ((trimmed.startsWith('\\') || /[_\^]=?/.test(trimmed)) && 
          !/^(and|the|where|if|is|are|with|matrix|eigenvalues|vectors|trace|minor|determinant)$/i.test(trimmed)) {
        return ` $${trimmed}$ `;
      }
      return token;
    });

    return t;
  }).join('');

  // 7. Balance odd number of $ signs to prevent runaway formatting
  const dollarIndices = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '$' && (i === 0 || s[i - 1] !== '\\')) {
      dollarIndices.push(i);
    }
  }
  if (dollarIndices.length % 2 !== 0) {
    const lastIdx = dollarIndices[dollarIndices.length - 1];
    s = s.substring(0, lastIdx) + s.substring(lastIdx + 1);
  }

  if (latexSanitizeCache.size >= MAX_LATEX_CACHE_SIZE) {
    const firstKey = latexSanitizeCache.keys().next().value;
    latexSanitizeCache.delete(firstKey);
  }
  latexSanitizeCache.set(key, s);

  return s;
};

const KATEX_OPTIONS_DISPLAY = {
  displayMode: true,
  throwOnError: false,
  errorColor: '#38bdf8',
  trust: true,
  strict: false,
  output: 'html',
  macros: {
    "\\tr": "\\operatorname{tr}",
    "\\det": "\\operatorname{det}",
    "\\gcd": "\\operatorname{gcd}",
    "\\lcm": "\\operatorname{lcm}",
    "\\rank": "\\operatorname{rank}"
  }
};

const KATEX_OPTIONS_INLINE = {
  displayMode: false,
  throwOnError: false,
  errorColor: '#38bdf8',
  trust: true,
  strict: false,
  output: 'html',
  macros: {
    "\\tr": "\\operatorname{tr}",
    "\\det": "\\operatorname{det}",
    "\\gcd": "\\operatorname{gcd}",
    "\\lcm": "\\operatorname{lcm}",
    "\\rank": "\\operatorname{rank}"
  }
};

export const formatMathText = (text) => {
  if (!text) return '';
  
  const normalized = sanitizeLatexString(text);

  // Match $$...$$ (display math) and $...$ (inline math)
  const mathRegex = /(\$\$[\s\S]*?\$\$|\$(?!\$)(?:[^$\\]|\\.){1,400}?\$)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mathRegex.exec(normalized)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      const plainText = normalized.slice(lastIndex, match.index);
      parts.push(plainText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'));
    }

    let raw = match[1];

    if (raw.startsWith('$$') && raw.endsWith('$$')) {
      let latex = raw.slice(2, -2).trim();
      try {
        parts.push(katex.renderToString(latex, KATEX_OPTIONS_DISPLAY));
      } catch {
        parts.push(`<code style="color:#38bdf8">${latex}</code>`);
      }
    } else {
      let latex = raw.slice(1, -1).trim();
      try {
        parts.push(katex.renderToString(latex, KATEX_OPTIONS_INLINE));
      } catch {
        parts.push(`<code style="color:#38bdf8">${latex}</code>`);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalized.length) {
    const plainText = normalized.slice(lastIndex);
    parts.push(plainText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'));
  }

  return (
    <span 
      style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }} 
      dangerouslySetInnerHTML={{ __html: parts.join('') }} 
    />
  );
};

// Regex to match any http/https URL that looks like an image (including Cloudinary)
const IMAGE_URL_REGEX = /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|svg|webp)(?:\?[^\s]*)?|https?:\/\/res\.cloudinary\.com\/[^\s]+)/gi;

/**
 * Splits a string into text segments and image URL segments, returns React elements.
 * Image URLs are rendered as <img> tags, text is passed to formatMathText.
 */
export const renderTextWithImages = (text, keyPrefix = '') => {
  if (!text) return null;
  const tokens = [];
  let lastIndex = 0;
  let match;
  IMAGE_URL_REGEX.lastIndex = 0;
  while ((match = IMAGE_URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: 'image', value: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }
  if (tokens.length === 0) {
    tokens.push({ type: 'text', value: text });
  }
  return tokens.map((token, i) => {
    if (token.type === 'image') {
      return (
        <img
          key={`${keyPrefix}-img-${i}`}
          src={token.value}
          alt="question image"
          style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain', borderRadius: '8px', margin: '12px 0', display: 'block' }}
        />
      );
    }
    return (
      <span key={`${keyPrefix}-txt-${i}`} style={{ whiteSpace: 'pre-wrap' }}>
        {formatMathText(token.value)}
      </span>
    );
  });
};

export const renderQuestionText = (text) => {
  if (!text) return null;
  // Clean up DETAILED_SOLUTION and convert Markdown headings to bold so they render cleanly
  let cleaned = text.replace(/DETAILED_SOLUTION\s*/g, '');
  cleaned = cleaned.replace(/^#+\s+(.*?)$/gm, '**$1**');
  
  const parts = cleaned.split(/```/);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      // code block handling
      const lines = part.split('\n');
      let code = part;
      
      if (lines[0]) {
        const firstLineTrim = lines[0].trim().toLowerCase();
        
        if (firstLineTrim === 'mermaid' || firstLineTrim.startsWith('graph ') || firstLineTrim.startsWith('flowchart') || firstLineTrim.startsWith('sequencediagram') || firstLineTrim.startsWith('classdiagram')) {
          const chartCode = firstLineTrim === 'mermaid' ? lines.slice(1).join('\n') : part;
          return <MermaidBlock key={idx} chart={chartCode.trim()} />;
        }

        if (['c','cpp','java','python','pseudocode','html','javascript','sql'].includes(firstLineTrim)) {
          code = lines.slice(1).join('\n');
        }
      }
      // Fallback check inside code content
      const trimmedCode = code.trim();
      if (trimmedCode.startsWith('graph ') || trimmedCode.startsWith('flowchart') || trimmedCode.startsWith('sequenceDiagram') || trimmedCode.startsWith('classDiagram')) {
        return <MermaidBlock key={idx} chart={trimmedCode} />;
      }
      return (
        <pre key={idx} className="code-terminal-pre">
          {code.trim()}
        </pre>
      );
    }
    // Use renderTextWithImages to handle inline Cloudinary/image URLs in text parts
    return <span key={idx}>{renderTextWithImages(part, `q-${idx}`)}</span>;
  });
};

// For rendering option text that might contain image URLs
export const renderOptionContent = (text) => {
  if (!text) return null;
  return renderTextWithImages(text, 'opt');
};

export const checkAnswerCorrect = (correct, selected) => {
  if (!correct || !selected) return false;

  const normalizeMsqString = (val) => {
    return val.trim().toLowerCase()
      .replace(/^option\s+/i, '')
      .replace(/[^a-d]/g, '')
      .split('')
      .sort()
      .join('');
  };

  const normC = normalizeMsqString(correct);
  const normS = normalizeMsqString(selected);
  if (normC && normC === normS) {
    return true;
  }

  const c = correct.trim().toLowerCase().replace(/^option\s+/i, '');
  const s = selected.trim().toLowerCase().replace(/^option\s+/i, '');
  if (c === s) return true;

  const sNum = parseFloat(s);
  if (!isNaN(sNum)) {
    const parts = c.split(/[-:to\s]+/);
    if (parts.length === 2) {
      const min = parseFloat(parts[0].trim());
      const max = parseFloat(parts[1].trim());
      if (!isNaN(min) && !isNaN(max)) {
        return sNum >= min && sNum <= max;
      }
    } else if (parts.length === 1) {
      const cNum = parseFloat(c);
      if (!isNaN(cNum)) {
        return Math.abs(cNum - sNum) < 1e-4;
      }
    }
  }
  return false;
};

export const renderMentorAnalysis = (explanation) => {
  if (!explanation) return <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No explanation parsed.</p>;

  // 1. Clean stray hashtags (lines containing only '#' or multiple '#' with no text)
  let cleaned = explanation
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      // Match lines that are just '#' or '##' etc. without actual heading text
      if (/^#+$/.test(trimmed)) {
        return '';
      }
      return line;
    })
    .join('\n');

  // Also replace any occurrences of isolated "### #" or "# \n"
  cleaned = cleaned.replace(/\n\s*#\s*\n/g, '\n\n');

  // 2. Render inside a SINGLE beautiful card
  return (
    <div 
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.02) 0%, transparent 100%)',
        boxShadow: 'var(--shadow-sm)',
        color: 'var(--text-secondary)',
        fontSize: '0.95rem',
        lineHeight: '1.7',
        marginTop: '16px'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {cleaned.split('\n').map((paragraph, pIdx) => {
          const trimmedPara = paragraph.trim();
          if (!trimmedPara) return null;

          // If paragraph is a markdown heading (e.g. ### Heading or #### Heading)
          const headingMatch = trimmedPara.match(/^(###+)\s*(.*)/);
          if (headingMatch) {
            const headingText = headingMatch[2].trim();
            
            // Icon selection
            let icon = '💡';
            if (headingText.toLowerCase().includes('solution') || headingText.toLowerCase().includes('step')) {
              icon = '📝';
            } else if (headingText.toLowerCase().includes('concept')) {
              icon = '🧠';
            }

            return (
              <h5 
                key={pIdx}
                style={{ 
                  fontSize: '1rem', 
                  fontWeight: 700, 
                  color: headingText.toLowerCase().includes('solution') || headingText.toLowerCase().includes('step') ? 'var(--color-success)' : 'var(--color-primary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginTop: pIdx > 0 ? '16px' : '4px',
                  marginBottom: '8px',
                  fontFamily: 'var(--font-title)'
                }}
              >
                <span>{icon}</span> {headingText}
              </h5>
            );
          }

          return (
            <p key={pIdx} style={{ margin: '0 0 12px 0', whiteSpace: 'pre-line' }}>
              {renderQuestionText(paragraph)}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export const renderAiChatText = (text) => {
  if (!text) return null;

  let cleaned = text
    .split('\n')
    .map(line => (/^#+$/.test(line.trim()) ? '' : line))
    .join('\n')
    .replace(/\n\s*#\s*\n/g, '\n\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {renderQuestionText(cleaned)}
    </div>
  );
};
