import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';

export const Wikilink = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      target: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {};
          return {
            target: dom.getAttribute('data-target') || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wiki': 'true',
        'data-target': HTMLAttributes.target,
        class: 'wiki-link'
      }),
      `[[${HTMLAttributes.target}]]`
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\[\[([^\]]+)\]\]$/,
        type: this.type,
        getAttributes: match => {
          return { target: match[1] };
        },
      }),
    ];
  },
});
