/**
 * Bookshelf case studies — one shelf *row* per project (plan §5).
 *
 * The shelf renders whatever this array contains, so adding or removing
 * entries needs no component changes: `scene/furniture/shelfLayout` re-divides
 * the carcass into one bay per entry, and each bay gets its own spine colour,
 * paper tag and camera stop.
 *
 * Array order is reading order, top shelf down.
 */

export interface Project {
  id: string
  title: string
  /**
   * Shown on the spine tag. Keep it to ~13 characters: the tag is a 168×24
   * texture and the title is drawn at 13px bold monospace with the year
   * right-aligned beside it, so anything longer runs under the year.
   */
  spine: string
  year: string
  role: string
  stack: string[]
  /** Spine colour; pulled from the room palette. */
  color: string
  summary: string
  sections: { heading: string; body: string }[]
  links?: { label: string; href: string }[]
}

export const PROJECTS: Project[] = [
  {
    id: 'aib-mobile-banking',
    title: 'AIB Mobile Banking',
    spine: 'AIB BANKING',
    year: '2024',
    role: 'Software Engineer · EPAM, for Allied Irish Banks',
    stack: ['React Native', 'TypeScript', 'Redux Toolkit', 'Jest'],
    color: '#4fd6c8',
    summary:
      'A production mobile banking app for one of Ireland’s largest banks, where I worked ' +
      'on the peer-to-peer money movement journeys — Request Money, Split a Bill, Money Transfer.',
    sections: [
      {
        heading: 'The problem',
        body:
          'Moving money between people is the part of a banking app with the least tolerance for ' +
          'sloppiness. A misformatted amount, an ambiguous button label or a search that quietly ' +
          'returns nothing is not a cosmetic bug here — it is the moment a customer decides they do ' +
          'not trust the app with their money. The payment journeys had accumulated a long tail of ' +
          'exactly those defects, and the regression backlog was growing faster than it was clearing.',
      },
      {
        heading: 'What I built',
        body:
          'I worked through the payment flows defect by defect: text and currency formatting, ' +
          'recipient search, button labels that did not say what the button did, spacing that broke ' +
          'at larger type sizes. Alongside that I refactored the shared UI modules those journeys ' +
          'depend on — several teams pull from them, so a component that was awkward to use was a ' +
          'tax being paid repeatedly across the codebase rather than in one place.',
      },
      {
        heading: 'What happened',
        body:
          'The QA regression backlog shrank release over release instead of growing. I raised ' +
          'automated coverage with Jest and React Native Testing Library, and went back through the ' +
          'snapshot suite — a lot of it had been re-recorded on failure rather than read, which is ' +
          'how a test suite ends up green and worthless. Rewriting those into assertions that ' +
          'actually state an expectation was the part I would do first next time, not last.',
      },
    ],
  },
  {
    id: 'avis-web-platform',
    title: 'Avis Budget Group — Web Platform',
    spine: 'AVIS WEB',
    year: '2024',
    role: 'Software Engineer · EPAM, for Avis Budget Group',
    stack: ['React', 'Adobe Experience Manager', 'WCAG', 'ARIA', 'SonarQube'],
    color: '#d64f9a',
    summary:
      'Enterprise web interfaces on Adobe Experience Manager, and the end-to-end accessibility ' +
      'remediation that took the platform to WCAG compliance.',
    sections: [
      {
        heading: 'The problem',
        body:
          'The platform had been built to look right, which is not the same as being usable. ' +
          'Accessibility failures were spread across it rather than concentrated anywhere ' +
          'convenient: ARIA attributes applied to elements that did not accept them, controls with ' +
          'no accessible name, no landmark regions to navigate by, dialogs that did not trap or ' +
          'return focus, and focus indicators that had been styled away because they looked untidy.',
      },
      {
        heading: 'What I built',
        body:
          'Two tracks in parallel. On the build side, reusable components and modal workflows taken ' +
          'from Figma through to production against AEM. On the remediation side, a systematic ' +
          'audit rather than a bug-by-bug scramble — group the failures by cause, fix the cause, ' +
          'then verify the whole class is gone. Dialog semantics and focus management were the ' +
          'expensive ones, because getting them right meant changing how the components were ' +
          'structured, not what they rendered.',
      },
      {
        heading: 'What happened',
        body:
          'The platform reached WCAG compliance, with design and QA in the loop throughout so the ' +
          'fixes survived the next round of design changes. Along the way I found a form-validation ' +
          'bug that let mandatory fields be bypassed entirely — a correctness hole hiding under an ' +
          'accessibility audit — and cleared the SonarQube code smells sitting behind it. The ' +
          'lasting lesson: accessibility is cheap when it is a constraint on the component and ' +
          'expensive when it is a ticket filed against the page.',
      },
    ],
  },
  {
    id: 'propertycue',
    title: 'PropertyCue',
    spine: 'PROPERTYCUE',
    year: '2023',
    role: 'Lead developer · final-year project',
    stack: ['Python', 'scikit-learn', 'React'],
    color: '#f0a848',
    summary:
      'A housing-price prediction platform pairing regression models with a React front end. ' +
      'The work became an IEEE paper, “Using Machine Learning to Predict Housing Prices” (2023).',
    sections: [
      {
        heading: 'The problem',
        body:
          'Housing price estimates are usually either a black box or a spreadsheet. We wanted ' +
          'something in between: a model good enough to be worth trusting, wrapped in an interface ' +
          'that let a person actually interrogate it rather than just read a number off it.',
      },
      {
        heading: 'What I built',
        body:
          'I led delivery end to end — data preprocessing, feature handling, training and ' +
          'evaluating the regression models, then the React interface on top. Most of the real work ' +
          'was upstream of the model: real housing data arrives dirty, and the difference between ' +
          'our first and last evaluation run had more to do with how we cleaned it than with which ' +
          'algorithm we picked.',
      },
      {
        heading: 'What happened',
        body:
          'The platform worked, and we co-authored and published the method as an IEEE paper in ' +
          '2023. Writing it up was the useful part: a claim that survives review has to be stated ' +
          'precisely enough to be wrong, which is a much higher bar than a demo that runs.',
      },
    ],
  },
  {
    id: 'expense-management',
    title: 'Expense Management System',
    spine: 'EXPENSE MGMT',
    year: '2025',
    role: 'Solo · in progress',
    stack: ['React', 'Spring Boot', 'PostgreSQL', 'JWT', 'Docker'],
    color: '#6a8caf',
    summary:
      'A full-stack expense tracker, built deliberately: the front end is the part I already ' +
      'know, so the point of this one is everything behind the API boundary.',
    sections: [
      {
        heading: 'The problem',
        body:
          'Two years of front-end work leaves you fluent on one side of an interface and ' +
          'hand-wavy on the other. I did not want a tutorial-shaped understanding of the backend — ' +
          'I wanted to have made the decisions myself, including the ones I would get wrong.',
      },
      {
        heading: 'What I built',
        body:
          'A React client against a Spring Boot API over PostgreSQL. JWT-based authentication, ' +
          'RESTful endpoints documented with Swagger, and the whole thing containerised so it comes ' +
          'up with a single Docker Compose command. Choosing an expense tracker was deliberate: the ' +
          'domain is boring enough that nothing interesting is hiding in the requirements, so all ' +
          'the difficulty lands where I wanted it — auth, schema design, and API shape.',
      },
      {
        heading: 'What happened',
        body:
          'Still in progress. What has already changed is how I read a backend: token expiry and ' +
          'refresh semantics stopped being someone else’s problem the first time I had to decide ' +
          'them, and I write front-end code against APIs differently now that I have designed a ' +
          'bad one and had to live with it.',
      },
    ],
  },
]
