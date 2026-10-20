import { parse, type SFCDescriptor } from "@vue/compiler-sfc";
import {
  NodeTypes,
  type ElementNode,
  type RootNode,
  type TemplateChildNode,
} from "@vue/compiler-dom";
import MagicString, { type SourceMap } from "magic-string";

export interface VueGrabCompilerOptions {
  root?: string;
  attributeName?: string;
  include?: (filename: string) => boolean;
  exclude?: (filename: string) => boolean;
}

export interface VueGrabTransformResult {
  code: string;
  map: SourceMap;
}

const isNativeElement = (node: ElementNode): boolean => {
  const tag = node.tag;
  if (!tag) return false;
  if (tag === "template" || tag === "slot" || tag === "component") return false;
  if (tag === tag.toLowerCase()) {
    return !["transition", "transition-group", "keep-alive", "teleport", "suspense"].includes(tag);
  }
  return false;
};

const hasLocationAttribute = (node: ElementNode, attributeName: string): boolean =>
  node.props.some(
    (prop: ElementNode["props"][number]) =>
      prop.type === NodeTypes.ATTRIBUTE && prop.name === attributeName,
  );

const walkTemplate = (
  nodes: TemplateChildNode[],
  callback: (node: ElementNode) => void,
): void => {
  for (const node of nodes) {
    if (node.type !== NodeTypes.ELEMENT) continue;
    callback(node);
    walkTemplate(node.children as TemplateChildNode[], callback);
  }
};

const toProjectPath = (filename: string, root: string | undefined): string => {
  let normalized = filename.replace(/\\/g, "/").replace(/[?#].*$/, "");
  if (root) {
    const normalizedRoot = root.replace(/\\/g, "/").replace(/\/$/, "");
    if (normalized.startsWith(normalizedRoot)) {
      normalized = normalized.slice(normalizedRoot.length);
    }
  }
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  return normalized.replace(/\/{2,}/g, "/");
};

const getTemplateRoot = (descriptor: SFCDescriptor): RootNode => {
  const template = descriptor.template;
  if (!template?.ast) {
    throw new Error("Vue Grab compiler could not read the template AST");
  }
  return template.ast;
};

export const transformVueGrabSFC = (
  source: string,
  filename: string,
  options: VueGrabCompilerOptions = {},
): VueGrabTransformResult | null => {
  if (options.include && !options.include(filename)) return null;
  if (options.exclude?.(filename)) return null;
  if (!filename.endsWith(".vue")) return null;

  const parseResult = parse(source, { filename, sourceMap: true });
  if (parseResult.errors.length > 0) return null;
  const descriptor = parseResult.descriptor;
  const template = descriptor.template;
  if (!template || template.lang || template.src) return null;

  const attributeName = options.attributeName ?? "data-vue-grab-loc";
  const projectPath = toProjectPath(filename, options.root);
  const magicString = new MagicString(source);
  const templateRoot = getTemplateRoot(descriptor);
  let didChange = false;

  walkTemplate(templateRoot.children, (node) => {
    if (!isNativeElement(node) || hasLocationAttribute(node, attributeName)) return;
    const { line, column } = node.loc.start;
    const insertionPoint = node.loc.start.offset + 1 + node.tag.length;
    magicString.appendLeft(
      insertionPoint,
      ` ${attributeName}="${projectPath}:${line}:${column}"`,
    );
    didChange = true;
  });

  if (!didChange) return null;
  return {
    code: magicString.toString(),
    map: magicString.generateMap({
      source: filename,
      includeContent: true,
      hires: true,
    }),
  };
};

export { parse as parseSFC };
