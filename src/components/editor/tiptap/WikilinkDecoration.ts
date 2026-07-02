import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const WikilinkDecoration = Extension.create({
  name: 'wikilinkDecoration',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikilinkDecoration'),
        state: {
          init(_, { doc }) {
            return getDecorations(doc);
          },
          apply(tr, old) {
            return tr.docChanged ? getDecorations(tr.doc) : old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function getDecorations(doc: any) {
  const decorations: Decoration[] = [];
  const regex = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;

  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      let match;
      while ((match = regex.exec(node.text)) !== null) {
        const start = pos + match.index;
        const end = start + match[0].length;
        const target = match[1];
        decorations.push(
          Decoration.inline(start, end, {
            class: 'wiki-link',
            'data-target': target,
          })
        );
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}
