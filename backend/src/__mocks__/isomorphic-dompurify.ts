/**
 * Jest manual mock for isomorphic-dompurify.
 *
 * isomorphic-dompurify loads jsdom in Node environments, which pulls in
 * html-encoding-sniffer and other packages that ship as ESM. Those packages
 * cannot be transformed by ts-jest without cascading transformIgnorePatterns
 * changes.
 *
 * DOMPurify sanitization behavior is tested in the frontend unit tests
 * (frontend/src/utils/markdown.test.ts). The backend tests that import
 * feasibility.service.ts only need the module to be present — they do not
 * assert on sanitization behavior, so a pass-through mock is sufficient.
 */
const DOMPurify = {
  sanitize: (input: string): string => input,
};

export default DOMPurify;
