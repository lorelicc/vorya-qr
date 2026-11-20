import type { MDXComponents } from "mdx/types";

/** Plain elements: the guide pages style them through their own CSS (.prose). */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components };
}
