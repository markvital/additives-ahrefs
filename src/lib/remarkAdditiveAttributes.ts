import type { Literal, Parent, Root, Text } from 'mdast';
import { visit } from 'unist-util-visit';

const ATTRIBUTE_PATTERN = /^\s*\{\s*([^}]+)\s*\}([\s\S]*)$/;

const extractClassNames = (raw: string): string[] => {
  return raw
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.startsWith('.'))
    .map((token) => token.slice(1))
    .filter((token) => token.length > 0);
};

const mergeClassNames = (existing: unknown, nextClassNames: string[]): string | undefined => {
  const normalizedExisting = Array.isArray(existing)
    ? existing
    : typeof existing === 'string' && existing.trim().length > 0
      ? existing.trim().split(/\s+/)
      : [];

  const merged = Array.from(new Set([...normalizedExisting, ...nextClassNames])).filter(Boolean);

  return merged.length > 0 ? merged.join(' ') : undefined;
};

/**
 * Minimal remark plugin to lift trailing attribute text (e.g. `{.additive}`)
 * into the preceding node's `className`.
 */
export function remarkAdditiveAttributes() {
  return function transform(tree: Root) {
    visit(tree, (node) => {
      if (!('children' in node) || !Array.isArray((node as Parent).children)) {
        return;
      }

      const parent = node as Parent;

      for (let index = 0; index < parent.children.length; index += 1) {
        const current = parent.children[index];

        if (current?.type !== 'text') {
          continue;
        }

        const attributeMatch = ATTRIBUTE_PATTERN.exec((current as Text).value ?? '');

        if (!attributeMatch) {
          continue;
        }

        const targetIndex = index - 1;

        if (targetIndex < 0) {
          continue;
        }

        const target = parent.children[targetIndex] as Parent & Literal;
        const classNames = extractClassNames(attributeMatch[1]);

        if (classNames.length === 0) {
          continue;
        }

        const existingClassName = (target.data as { hProperties?: { className?: unknown } } | undefined)?.hProperties
          ?.className;
        const mergedClassName = mergeClassNames(existingClassName, classNames);

        if (!mergedClassName) {
          continue;
        }

        target.data = {
          ...target.data,
          hProperties: {
            ...target.data?.hProperties,
            className: mergedClassName,
          },
        };

        const remainingText = attributeMatch[2] ?? '';

        if (remainingText.trim().length === 0) {
          parent.children.splice(index, 1);
          index -= 1;
        } else {
          (current as Text).value = remainingText;
        }
      }
    });
  };
}
