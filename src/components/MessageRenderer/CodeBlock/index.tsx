'use client';

import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/light-async';
import darkTheme from './CodeBlockDarkTheme';
import lightTheme from './CodeBlockLightTheme';

const SyntaxHighlighterComponent =
  SyntaxHighlighter as unknown as React.ComponentType<any>;

// The async build loads each language's grammar on first use instead of
// bundling all of highlight.js, but only knows grammars by their full name.
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  py: 'python',
  py3: 'python',
  sh: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  ps1: 'powershell',
  ps: 'powershell',
  html: 'xml',
  xhtml: 'xml',
  svg: 'xml',
  vue: 'xml',
  'c++': 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  h: 'c',
  cs: 'csharp',
  'c#': 'csharp',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  kts: 'kotlin',
  golang: 'go',
  yml: 'yaml',
  md: 'markdown',
  jsonc: 'json',
  json5: 'json',
  objc: 'objectivec',
  'objective-c': 'objectivec',
  docker: 'dockerfile',
  make: 'makefile',
  postgres: 'pgsql',
  postgresql: 'pgsql',
  tex: 'latex',
  txt: 'plaintext',
  text: 'plaintext',
};

const toHighlightLanguage = (language: string) => {
  const name = language.trim().toLowerCase();
  if (!name) return 'text';
  return LANGUAGE_ALIASES[name] ?? name;
};

const CodeBlock = ({
  language,
  children,
}: {
  language: string;
  children: React.ReactNode;
}) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const syntaxTheme = useMemo(() => {
    if (!mounted) return lightTheme;
    return resolvedTheme === 'dark' ? darkTheme : lightTheme;
  }, [mounted, resolvedTheme]);

  return (
    <div className="relative">
      <button
        className="absolute top-2 right-2 p-1"
        onClick={() => {
          navigator.clipboard.writeText(children as string);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? (
          <CheckIcon
            size={16}
            className="absolute top-2 right-2 text-black/70 dark:text-white/70"
          />
        ) : (
          <CopyIcon
            size={16}
            className="absolute top-2 right-2 transition duration-200 text-black/70 dark:text-white/70 hover:text-gray-800/70 hover:dark:text-gray-300/70"
          />
        )}
      </button>
      <SyntaxHighlighterComponent
        language={toHighlightLanguage(language)}
        style={syntaxTheme}
        showInlineLineNumbers
      >
        {children as string}
      </SyntaxHighlighterComponent>
    </div>
  );
};

// Highlighting is costly and the answer re-renders as it streams in, so a
// block is only redone when its own code changes.
export default memo(CodeBlock);
