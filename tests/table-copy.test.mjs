// node --experimental-strip-types --test tests/table-copy.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, afterEach, test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import katex from 'katex';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const dom = new JSDOM('', { url: 'https://vane.test' });
const { document, localStorage } = dom.window;

// Load the real TSX module and URL preferences without a bundler; only the
// stylesheet import needs to be skipped in Node.
const loadModule = (path) => {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  );
  const compiledModule = { exports: {} };
  runInNewContext(outputText, {
    module: compiledModule,
    exports: compiledModule.exports,
    localStorage,
    require: (name) => {
      if (name.endsWith('.css')) return {};
      if (name === '@/lib/utils/urlDecode') {
        return loadModule('../src/lib/utils/urlDecode.ts');
      }
      return require(name);
    },
  });
  return compiledModule.exports;
};

const { tableToMarkdown } = loadModule(
  '../src/components/MessageRenderer/MathTex.tsx',
);

const tableWithCell = (content) => {
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Evidence</th></tr></thead><tbody><tr><td>${content}</td></tr></tbody>`;
  return table;
};

afterEach(() => localStorage.clear());
after(() => dom.window.close());

test('table copy keeps adjacent citation numbers linked to their sources', () => {
  const table = tableWithCell(
    'Supported<a href="https://example.com/one">1</a><a href="https://example.com/seven">7</a>',
  );

  assert.equal(
    tableToMarkdown(table),
    '| Evidence |\n| --- |\n| Supported[1](https://example.com/one)[7](https://example.com/seven) |',
  );
  assert.equal(table.querySelector('td').textContent, 'Supported17');
  assert.equal(table.querySelectorAll('a').length, 2);
});

test('table citation URLs are decoded by default', () => {
  const table = tableWithCell(
    '<a href="https://example.com/%ED%95%9C%EA%B8%80">2</a>',
  );

  assert.equal(
    tableToMarkdown(table),
    '| Evidence |\n| --- |\n| [2](https://example.com/한글) |',
  );
});

test('table copy respects the preference to keep citation URLs encoded', () => {
  localStorage.setItem('decodeCitationUrls', 'false');
  const table = tableWithCell(
    '<a href="https://example.com/%ED%95%9C%EA%B8%80">2</a>',
  );

  assert.equal(
    tableToMarkdown(table),
    '| Evidence |\n| --- |\n| [2](https://example.com/%ED%95%9C%EA%B8%80) |',
  );
});

test('links keep table delimiters out of URLs without damaging math or cell text', () => {
  const table = tableWithCell(
    `${katex.renderToString('x^2')} | <a href="https://example.com/a|b?q=c%7Cd">3</a><button>Copy</button>`,
  );

  assert.equal(
    tableToMarkdown(table),
    '| Evidence |\n| --- |\n| $x^2$ \\| [3](https://example.com/a%7Cb?q=c%7Cd) |',
  );
  assert.ok(table.querySelector('.katex'));
  assert.ok(table.querySelector('button'));
});

test('ordinary links retain their destinations and anchors without href stay text', () => {
  const table = tableWithCell(
    '<a href="/docs">Read docs</a> <a>Unlinked</a> <a href="file_id://report/content">4</a>',
  );

  assert.equal(
    tableToMarkdown(table),
    '| Evidence |\n| --- |\n| [Read docs](/docs) Unlinked [4](file_id://report/content) |',
  );
});

test('a malformed percent escape does not prevent copying a citation', () => {
  const table = tableWithCell('<a href="https://example.com/%ZZ">5</a>');

  assert.equal(
    tableToMarkdown(table),
    '| Evidence |\n| --- |\n| [5](https://example.com/%ZZ) |',
  );
});
