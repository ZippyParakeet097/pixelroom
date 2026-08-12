/**
 * Contact links — the window hotspot (plan §5).
 *
 * Deliberately no phone number, even though the PDF résumé carries one: the
 * PDF goes to people who asked for it, this page goes to crawlers. Anyone who
 * needs the number gets it from the download.
 */

/**
 * The mark drawn beside an entry.
 *
 * Two cases rather than one glyph field, because the two things are not the
 * same kind of object. GitHub and LinkedIn are trademarks with published marks
 * and published rules about them; the earlier stand-ins (`⌥` for GitHub, `▤`
 * for LinkedIn) were arbitrary Unicode that happened to be in the font and
 * identified neither. Email is a protocol, not a brand — there is no official
 * mark to reach for, so it keeps a glyph.
 *
 * Brand files live in `public/assets/icons`, downloaded from each owner's own
 * brand page (github.com/logos, brand.linkedin.com/downloads) and resized but
 * not otherwise altered — the LinkedIn bug keeps its ® mark, which is why it
 * is wider than tall and why the CSS sizes the two marks separately.
 */
export type ContactMark =
  | { kind: 'brand'; src: string; alt: string }
  | { kind: 'glyph'; char: string }

export interface ContactLink {
  id: string
  label: string
  value: string
  href: string
  mark: ContactMark
}

export const CONTACT_LINKS: ContactLink[] = [
  {
    id: 'email',
    label: 'Email',
    value: 'harshil.prakash5601@gmail.com',
    href: 'mailto:harshil.prakash5601@gmail.com',
    mark: { kind: 'glyph', char: '✉' },
  },
  {
    id: 'github',
    label: 'GitHub',
    value: 'github.com/ZippyParakeet097',
    href: 'https://github.com/ZippyParakeet097',
    mark: { kind: 'brand', src: '/assets/icons/github-mark.png', alt: 'GitHub' },
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    value: 'linkedin.com/in/harshil-prakash',
    href: 'https://www.linkedin.com/in/harshil-prakash-3983a7276/',
    mark: { kind: 'brand', src: '/assets/icons/linkedin-in-bug.png', alt: 'LinkedIn' },
  },
]

export const CONTACT_BLURB =
  'Hyderabad, India — so most of the day I am some number of hours ahead of you. ' +
  'Email is the fastest way in; LinkedIn works if that is your habit. Open to work ' +
  'where the front end is treated as engineering rather than decoration.'
