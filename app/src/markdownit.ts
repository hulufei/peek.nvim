import { hashCode, uniqueIdGen } from './util.ts';
import { parse } from 'https://deno.land/std@0.159.0/flags/mod.ts';
import { default as highlight } from 'https://cdn.skypack.dev/highlight.js@11.6.0';
// @deno-types="https://esm.sh/v133/@types/markdown-it@13.0.5/index.d.ts";
import MarkdownIt from 'https://esm.sh/markdown-it@13.0.2';
import { default as MarkdownItEmoji } from 'https://esm.sh/markdown-it-emoji@2.0.2';
import { default as MarkdownItFootnote } from 'https://esm.sh/markdown-it-footnote@3.0.3';
import { default as MarkdownItTaskLists } from 'https://esm.sh/markdown-it-task-lists@2.1.1';
import { default as MarkdownItTexmath } from 'https://esm.sh/markdown-it-texmath@1.0.0';
import Katex from 'https://esm.sh/katex@0.16.3';

const __args = parse(Deno.args);

const md = new MarkdownIt('default', {
  html: true,
  typographer: true,
  linkify: true,
  langPrefix: 'language-',
  highlight: __args['syntax'] && ((code, language) => {
    if (language && highlight.getLanguage(language)) {
      try {
        return highlight.highlight(code, { language }).value;
      } catch {
        return code;
      }
    }

    return '';
  }),
}).use(MarkdownItEmoji)
  .use(MarkdownItFootnote)
  .use(MarkdownItTaskLists, { enabled: false, label: true })
  .use(MarkdownItTexmath, {
    engine: Katex,
    delimiters: ['gitlab', 'dollars'],
    katexOptions: { macros: { '\\R': '\\mathbb{R}' } },
  });

md.renderer.rules.link_open = (tokens, idx, options) => {
  const token = tokens[idx];
  const href = token.attrGet('href');

  if (href && href.startsWith('#')) {
    token.attrSet('onclick', `location.hash='${href}'`);
  }

  token.attrSet('href', 'javascript:return');

  return md.renderer.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = (tokens, idx, options) => {
  tokens[idx].attrSet(
    'id',
    tokens[idx + 1].content
      .trim()
      .split(' ')
      .filter((a) => a)
      .join('-')
      .replace(/[^a-z0-9-]/gi, '')
      .toLowerCase(),
  );

  return md.renderer.renderToken(tokens, idx, options);
};

md.renderer.rules.math_block = (() => {
  const math_block = md.renderer.rules.math_block!;

  return (tokens, idx, options, env, self) => {
    return `
      <div
        data-line-begin="${tokens[idx].attrGet('data-line-begin')}"
      >
        ${math_block(tokens, idx, options, env, self)}
      </div>
    `;
  };
})();

md.renderer.rules.math_block_eqno = (() => {
  const math_block_eqno = md.renderer.rules.math_block_eqno!;

  return (tokens, idx, options, env, self) => {
    return `
      <div
        data-line-begin="${tokens[idx].attrGet('data-line-begin')}"
      >
        ${math_block_eqno(tokens, idx, options, env, self)}
      </div>
    `;
  };
})();

md.renderer.rules.fence = (() => {
  const fence = md.renderer.rules.fence!;
  const escapeHtml = md.utils.escapeHtml;
  const regex = new RegExp(
    /^(flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram|pie|journey|C4Context|erDiagram|requirementDiagram|gitGraph)/,
  );

  return (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const content = token.content.trim();

    if (regex.test(content)) {
      return `
        <div
          class="mermaid"
          data-line-begin="${token.attrGet('data-line-begin')}"
        >
          <div
            id="graph-mermaid-${env.genId(hashCode(content))}"
            data-graph="mermaid"
            data-graph-definition="${escapeHtml(content)}"
          >
            <div class="loader"></div>
          </div>
        </div>
      `;
    }

    return fence(tokens, idx, options, env, self);
  };
})();

export function render(markdown: string) {
  const tokens = md.parse(markdown, {});

  tokens.forEach((token) => {
    if (token.map && token.level === 0) {
      token.attrSet('data-line-begin', String(token.map[0] + 1));
    }
  });

  return md.renderer.render(tokens, md.options, { genId: uniqueIdGen() });
}
