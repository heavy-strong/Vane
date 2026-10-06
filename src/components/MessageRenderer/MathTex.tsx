import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const texOf = (el: Element) =>
  el.querySelector('annotation[encoding="application/x-tex"]')?.textContent ??
  '';

/**
 * When a selection containing rendered formulas is copied, put their LaTeX
 * source (`$..$` / `$$..$$`, as Obsidian expects) on the clipboard instead of
 * the duplicated HTML + MathML glyph text.
 */
const handleCopy = (event: ClipboardEvent) => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !event.clipboardData) return;

  const range = selection.getRangeAt(0).cloneRange();

  // Grow the range so partially selected formulas are copied whole.
  const startKatex = range.startContainer.parentElement?.closest('.katex');
  const endKatex = range.endContainer.parentElement?.closest('.katex');
  const startDisplay = startKatex?.closest('.katex-display') ?? startKatex;
  const endDisplay = endKatex?.closest('.katex-display') ?? endKatex;
  if (startDisplay) range.setStartBefore(startDisplay);
  if (endDisplay) range.setEndAfter(endDisplay);

  const fragment = range.cloneContents();
  if (!fragment.querySelector('.katex')) return;

  fragment.querySelectorAll('.katex-display').forEach((el) => {
    el.replaceWith(`\n$$\n${texOf(el)}\n$$\n`);
  });
  fragment.querySelectorAll('.katex').forEach((el) => {
    el.replaceWith(`$${texOf(el)}$`);
  });
  fragment.querySelectorAll('button').forEach((el) => el.remove());

  // innerText (unlike textContent) keeps paragraph/line breaks, but only
  // works on attached, rendered nodes.
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-99999px;top:0;white-space:pre-wrap;';
  container.appendChild(fragment);
  document.body.appendChild(container);
  const text = container.innerText.replace(/\n{3,}/g, '\n\n').trim();
  document.body.removeChild(container);

  event.clipboardData.setData('text/plain', text);
  event.preventDefault();
};

// Guard against duplicate listeners across hot reloads.
if (typeof window !== 'undefined' && !(window as any).__mathCopyHandler) {
  (window as any).__mathCopyHandler = true;
  document.addEventListener('copy', handleCopy);
}

const MathTex = ({ tex, display }: { tex: string; display?: string }) => {
  const source = decodeURIComponent(tex);
  const isDisplay = display === '1';
  const [copied, setCopied] = useState(false);

  const copyTex = () => {
    navigator.clipboard.writeText(`$$\n${source}\n$$`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  const html = katex.renderToString(source, {
    displayMode: isDisplay,
    throwOnError: false,
    output: 'htmlAndMathml',
  });

  return isDisplay ? (
    <span className="group relative block my-3">
      <span
        className="block overflow-x-auto overflow-y-hidden"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <button
        type="button"
        onClick={copyTex}
        title="Copy LaTeX"
        className="absolute top-0 right-0 p-1.5 rounded-md select-none opacity-0 group-hover:opacity-100 focus:opacity-100 transition duration-200 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-light-secondary dark:hover:bg-dark-secondary"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
};

/**
 * Replaces LaTeX math (`\[..\]`, `$$..$$`, `\(..\)`, `$..$`) outside code
 * with `<mathtex>` tags, since markdown-to-jsx would otherwise eat the
 * backslashes and leave unreadable text like `[ \frac{1}{6} ]`.
 */
export const preprocessMath = (markdown: string): string => {
  const toTag = (tex: string, display: boolean) =>
    `<mathtex tex="${encodeURIComponent(tex.trim())}" display="${display ? '1' : '0'}"></mathtex>`;

  // Odd segments are fenced/inline code and are left untouched.
  return markdown
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => toTag(tex, true))
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => toTag(tex, true))
        .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => toTag(tex, false))
        .replace(/(?<![\\$\w])\$(?![\s$])([^$\n]+?)(?<!\s)\$(?![\w$])/g, (_, tex) =>
          toTag(tex, false),
        );
    })
    .join('');
};

/**
 * Rewrites `\\[..\\]` / `\\(..\\)` to `$$..$$` / `$..$`, the delimiters
 * Obsidian and most markdown editors understand.
 */
export const normalizeMathDelimiters = (markdown: string): string =>
  markdown
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => `\n$$\n${tex.trim()}\n$$\n`)
            .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => `$${tex.trim()}$`),
    )
    .join('');

export default MathTex;
