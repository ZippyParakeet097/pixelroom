/**
 * Résumé content (plan §6, §15).
 *
 * The one place the real history lives. The viewer, the terminal's `resume`
 * and `about` commands and the mobile gate all read from here, so replacing
 * this file swaps the résumé everywhere.
 *
 * `public/assets/resume.pdf` is the same document as a PDF and has to be
 * re-exported whenever this changes, or the download hands over a stale copy.
 */

/**
 * Named rather than `resume.pdf` so the file is still identifiable once it is
 * sitting in someone's downloads folder next to four other résumés.
 */
export const RESUME_PDF_PATH = '/assets/harshil-prakash-resume.pdf'

/**
 * A client engagement inside a role. Consultancy work is two facts, not one —
 * who employs you and whose product you actually shipped — and collapsing them
 * loses the part a reader cares about.
 */
export interface ResumeEngagement {
  client: string
  /** Domain and surface, e.g. "Mobile banking · FinTech". */
  context: string
  bullets: string[]
}

export interface ResumeRole {
  company: string
  title: string
  period: string
  location: string
  bullets?: string[]
  engagements?: ResumeEngagement[]
}

export interface ResumeEducation {
  school: string
  credential: string
  period: string
  location?: string
  detail?: string[]
}

export interface ResumeData {
  name: string
  headline: string
  summary: string
  location: string
  email: string
  links: { label: string; href: string }[]
  roles: ResumeRole[]
  skills: { group: string; items: string[] }[]
  education: ResumeEducation[]
}

export const RESUME: ResumeData = {
  name: 'Harshil Prakash',
  headline: 'Software Engineer · React & React Native',
  location: 'Hyderabad, India',
  email: 'harshil.prakash5601@gmail.com',
  links: [
    { label: 'github.com/ZippyParakeet097', href: 'https://github.com/ZippyParakeet097' },
    {
      label: 'linkedin.com/in/harshil-prakash',
      href: 'https://www.linkedin.com/in/harshil-prakash-3983a7276/',
    },
  ],
  summary:
    'Front-end engineer at EPAM, working on client products where the details are the job — ' +
    'payment journeys that cannot round a number wrong, and interfaces that have to work for ' +
    'someone who never touches a mouse. Currently extending into backend so I can own a ' +
    'feature end to end instead of stopping at the API boundary.',
  roles: [
    {
      company: 'EPAM Systems',
      title: 'Software Engineer',
      period: 'Mar 2024 — Present',
      location: 'Hyderabad, India',
      engagements: [
        {
          client: 'Allied Irish Banks',
          context: 'Mobile banking · FinTech',
          bullets: [
            'Shipped into a production mobile banking app used for peer-to-peer money movement — Request Money, Split a Bill, Money Transfer.',
            'Cleared UI defects across the payment journeys — text formatting, search, button labels, layout spacing — cutting down the QA regression backlog release over release.',
            'Raised automated test coverage with Jest and React Native Testing Library, and refactored snapshot tests that had been re-recorded rather than read.',
            'Refactored shared UI modules for maintainability, paying down technical debt in components several teams depended on.',
          ],
        },
        {
          client: 'Avis Budget Group',
          context: 'Web platform · Automotive',
          bullets: [
            'Built enterprise web interfaces on Adobe Experience Manager, taking reusable components and modal workflows from Figma through to production.',
            'Led end-to-end accessibility remediation: invalid ARIA attributes, missing accessible names, landmark regions, dialog semantics, and focus-visible behaviour.',
            'Took the platform to WCAG compliance through a systematic audit and targeted fixes, working alongside design and QA rather than bolting it on afterwards.',
            'Found and fixed a form-validation bug that let mandatory fields be bypassed entirely; cleared SonarQube code smells behind it.',
          ],
        },
      ],
    },
  ],
  skills: [
    {
      group: 'Frontend',
      items: [
        'React',
        'React Native',
        'TypeScript',
        'JavaScript',
        'Redux Toolkit',
        'HTML5',
        'CSS3',
        'Material UI',
      ],
    },
    {
      group: 'Accessibility',
      items: [
        'WCAG',
        'ARIA',
        'Landmark regions',
        'Focus management',
        'Dialog accessibility',
        'Keyboard navigation',
      ],
    },
    {
      group: 'Testing',
      items: ['Jest', 'React Native Testing Library', 'Snapshot testing', 'Unit testing'],
    },
    {
      group: 'Tools',
      items: [
        'Adobe Experience Manager',
        'SonarQube',
        'Jenkins',
        'Jira',
        'Git',
        'GitHub',
        'Bitbucket',
      ],
    },
    {
      group: 'Backend',
      items: [
        'Core Java',
        'Node.js',
        'REST APIs',
        'SQL',
        'Spring Boot (learning)',
        'Docker (learning)',
      ],
    },
  ],
  education: [
    {
      school: 'KIET Group of Institutions',
      credential: 'B.Tech, Computer Science',
      period: 'Aug 2019 — Jun 2023',
      location: 'Delhi NCR, India',
      detail: [
        'Coursework: data structures, algorithms, databases, computer systems, machine learning.',
        'Publication: “Using Machine Learning to Predict Housing Prices” — IEEE, 2023.',
      ],
    },
  ],
}
