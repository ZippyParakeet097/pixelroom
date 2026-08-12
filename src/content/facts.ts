/**
 * Corkboard notes — the about-me hotspot (plan §5).
 *
 * Tone target is dry and specific rather than "fun fact!" — one concrete
 * detail per note beats a list of adjectives. Six notes fills the two-column
 * grid to three even rows; add in pairs or the last row goes lopsided.
 */

export interface Fact {
  id: string
  /** Short heading, written on the pin-up. */
  title: string
  body: string
  /** Paper tint; the board mixes these so it looks pinned, not generated. */
  tone: 'paper' | 'yellow' | 'blue' | 'photo'
  /** Degrees. Small values only — the board should look casual, not chaotic. */
  tilt: number
}

export const FACTS: Fact[] = [
  {
    id: 'published',
    title: 'Published, once',
    body:
      '“Using Machine Learning to Predict Housing Prices”, IEEE, 2023. Co-authored out of a ' +
      'final-year project. The models were the easy half; the writing was where I found out ' +
      'which parts I did not actually understand.',
    tone: 'paper',
    tilt: -2.5,
  },
  {
    id: 'snapshots',
    title: 'On snapshot tests',
    body:
      'A snapshot you re-record every time it goes red is not a test, it is a diff you have ' +
      'agreed to stop reading. I have deleted more of them than I have written, and the suites ' +
      'got better both times.',
    tone: 'yellow',
    tilt: 1.8,
  },
  {
    id: 'focus-rings',
    title: 'Do not delete the focus ring',
    body:
      'It gets removed because it looks untidy in a Figma frame. Then someone who navigates by ' +
      'keyboard loads the page and has no idea where they are. Restyle it if you must. Do not ' +
      'remove it.',
    tone: 'blue',
    tilt: -1.2,
  },
  {
    id: 'the-good-bug',
    title: 'The best bug I have found',
    body:
      'An accessibility audit on a rental platform turned up a form that let you skip its ' +
      'mandatory fields entirely. Nobody was looking for it — I was reading the markup for ARIA ' +
      'and the validation was simply not there.',
    tone: 'yellow',
    tilt: 2.4,
  },
  {
    id: 'learning',
    title: 'Currently bad at',
    body:
      'Backend. Which is why there is a Spring Boot and Postgres service on the shelf that ' +
      'nobody asked for. Stated without apology: two years of React makes you fluent on exactly ' +
      'one side of an API.',
    tone: 'paper',
    tilt: -3,
  },
  {
    id: 'hyderabad',
    title: 'Hyderabad, 2024',
    body:
      'Moved down from Delhi NCR for the EPAM job. Left a college town for a city where the ' +
      'work is client work — real users, real money, and a QA team who will find what you missed.',
    tone: 'photo',
    tilt: 1.4,
  },
]
