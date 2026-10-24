import DOMPurify from 'dompurify';

export const safeHtml = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html ?? '', { ADD_ATTR: ['target'], FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select'], FORCE_BODY: true });
