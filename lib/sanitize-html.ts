import sanitizeHtml from 'sanitize-html'

const RICH_TEXT_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li',
  'blockquote', 'cite',
  'pre', 'code',
  'a', 'div', 'span',
]

const RICH_TEXT_ATTRIBUTES = ['href', 'title', 'target', 'rel']

const SVG_TAGS = [
  'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect',
]

const SVG_ATTRIBUTES = [
  'viewBox', 'width', 'height',
  'fill', 'fill-rule', 'clip-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'd', 'points',
  'cx', 'cy', 'r', 'rx', 'ry',
  'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'transform', 'opacity',
]

export function sanitizeRichText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: RICH_TEXT_TAGS,
    allowedAttributes: { '*': RICH_TEXT_ATTRIBUTES },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
  })
}

/** Editor copy placed on a page that already has its own H1: any H1 becomes an H2. */
export function sanitizePageCopy(html: string) {
  return sanitizeHtml(html, {
    allowedTags: RICH_TEXT_TAGS,
    allowedAttributes: { '*': RICH_TEXT_ATTRIBUTES },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: { h1: 'h2' },
  })
}

export function sanitizeEmphasisTitle(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ['em'],
    allowedAttributes: {},
  })
}

export function sanitizeInlineSvg(svg: string) {
  return sanitizeHtml(svg, {
    allowedTags: SVG_TAGS,
    allowedAttributes: { '*': SVG_ATTRIBUTES },
    allowedSchemes: [],
    allowProtocolRelative: false,
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
    },
  })
}
