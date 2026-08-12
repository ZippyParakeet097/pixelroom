import { RESUME, RESUME_PDF_PATH } from '@/apps/resume/resumeData'
import { PROJECTS } from '@/content/projects'
import { CONTACT_LINKS } from '@/content/contact'
import { FACTS } from '@/content/facts'

export interface CommandContext {
  /** Wipes the scrollback. */
  clear: () => void
  /** Opens another app on the desktop, e.g. `resume` launching the viewer. */
  launch: (appId: 'terminal' | 'resume' | 'snake' | 'contra' | 'notes') => void
}

export interface CommandResult {
  lines: string[]
  tone?: 'normal' | 'error' | 'accent'
}

export interface CommandDefinition {
  name: string
  summary: string
  /** Hidden commands stay out of `help` but still run. */
  hidden?: boolean
  run: (args: string[], context: CommandContext) => CommandResult | void
}

/**
 * Fake shell command set (plan §6).
 *
 * The visible commands are wired to the same content files the panels read, so
 * editing `content/` or `resumeData.ts` updates the shell for free — nothing
 * here restates a fact that lives somewhere else. The hidden ones are jokes.
 *
 * There is no filesystem: `ls`/`cat` operate on a fixed table, which is enough
 * to make the shell feel explorable without pretending to be a real one.
 */

const FILES: Record<string, string[]> = {
  'about.txt': [
    RESUME.summary,
    '',
    `Currently: ${RESUME.headline}, ${RESUME.location}.`,
  ],
  'resume.pdf': ['(binary) — run `resume` to open the viewer.'],
  'projects/': PROJECTS.map((p) => `  ${p.spine.toLowerCase().replace(/\s+/g, '-')}.md`),
  'contact.txt': CONTACT_LINKS.map((link) => `${link.label.padEnd(10)} ${link.value}`),
  '.secret': ['You went looking. Respect.', 'Try: `coffee`'],
}

export const COMMANDS: CommandDefinition[] = [
  {
    name: 'help',
    summary: 'list available commands',
    run: () => ({
      lines: [
        'Available commands:',
        '',
        ...COMMANDS.filter((c) => !c.hidden).map((c) => `  ${c.name.padEnd(10)} ${c.summary}`),
        '',
        'Tip: ↑/↓ for history, Tab to complete.',
      ],
    }),
  },
  {
    name: 'about',
    summary: 'who is this',
    run: () => ({ lines: [RESUME.summary, '', `${RESUME.headline} · ${RESUME.location}`] }),
  },
  {
    name: 'resume',
    summary: 'open the résumé viewer',
    run: (_args, context) => {
      context.launch('resume')
      return { lines: ['Opening Resume.pdf…'], tone: 'accent' }
    },
  },
  {
    name: 'projects',
    summary: 'list case studies',
    run: (args) => {
      if (args.length > 0) {
        const query = args.join(' ').toLowerCase()
        const match = PROJECTS.find(
          (p) => p.title.toLowerCase().includes(query) || p.id.includes(query),
        )
        if (!match) return { lines: [`No project matching "${args.join(' ')}".`], tone: 'error' }
        return {
          lines: [
            match.title,
            '─'.repeat(match.title.length),
            `${match.year} · ${match.role} · ${match.stack.join(', ')}`,
            '',
            match.summary,
            '',
            ...match.sections.flatMap((section) => [`${section.heading}:`, `  ${section.body}`, '']),
          ],
        }
      }
      return {
        lines: [
          'Case studies (run `projects <name>` for detail):',
          '',
          ...PROJECTS.map((p) => `  ${p.year}  ${p.title.padEnd(28)} ${p.stack.join('/')}`),
        ],
      }
    },
  },
  {
    name: 'contact',
    summary: 'ways to reach me',
    run: () => ({
      lines: CONTACT_LINKS.map((link) => `  ${link.label.padEnd(10)} ${link.value}`),
    }),
  },
  {
    name: 'facts',
    summary: 'read the corkboard',
    run: () => ({
      lines: FACTS.flatMap((fact) => [`· ${fact.title}`, `    ${fact.body}`]),
    }),
  },
  {
    name: 'ls',
    summary: 'list files',
    run: () => ({ lines: ['  ' + Object.keys(FILES).filter((f) => !f.startsWith('.')).join('   ')] }),
  },
  {
    name: 'cat',
    summary: 'print a file',
    run: (args) => {
      const name = args[0]
      if (!name) return { lines: ['usage: cat <file>'], tone: 'error' }
      const file = FILES[name]
      if (!file) return { lines: [`cat: ${name}: No such file or directory`], tone: 'error' }
      return { lines: file }
    },
  },
  {
    name: 'download',
    summary: 'grab résumé.pdf',
    run: () => {
      const anchor = document.createElement('a')
      anchor.href = RESUME_PDF_PATH
      anchor.download = 'harshil-prakash-resume.pdf'
      anchor.click()
      return { lines: ['Obtained: résumé.pdf'], tone: 'accent' }
    },
  },
  {
    name: 'snake',
    summary: 'launch Snake.exe',
    run: (_args, context) => {
      context.launch('snake')
      return { lines: ['Launching Snake.exe…'], tone: 'accent' }
    },
  },
  {
    name: 'contra',
    summary: 'launch Contra.exe',
    run: (_args, context) => {
      context.launch('contra')
      return { lines: ['Launching Contra.exe…'], tone: 'accent' }
    },
  },
  {
    name: 'clear',
    summary: 'clear the screen',
    run: (_args, context) => {
      context.clear()
    },
  },

  // Hidden ------------------------------------------------------------------
  {
    name: 'whoami',
    summary: 'hmm',
    hidden: true,
    run: () => ({
      lines: ['guest', '', 'The other account is harshil. He left the mug.'],
    }),
  },
  {
    name: 'sudo',
    summary: 'no',
    hidden: true,
    run: () => ({
      lines: ['guest is not in the sudoers file. This incident has been reported.'],
      tone: 'error',
    }),
  },
  {
    name: 'coffee',
    summary: 'brew',
    hidden: true,
    run: () => ({
      lines: ['Error 418: I am a teapot.', 'There is a mug on the desk. It is empty. It has been empty for a while.'],
      tone: 'accent',
    }),
  },
  {
    name: 'exit',
    summary: 'leave',
    hidden: true,
    run: () => ({ lines: ['You cannot exit. You live here now.', '(Try Esc.)'] }),
  },
  {
    name: 'rm',
    summary: 'no',
    hidden: true,
    run: (args) =>
      args.includes('-rf')
        ? { lines: ['Nice try.'], tone: 'error' }
        : { lines: ['rm: refusing to remove anything in a fake filesystem'], tone: 'error' },
  },
]

export const COMMAND_MAP = new Map(COMMANDS.map((command) => [command.name, command]))

export const BANNER = [
  'ManCaveOS [Version 5.1.2600]',
  '(c) Harshil Prakash. All rights reserved-ish.',
  '',
  "Type `help` if you're lost.",
  '',
]
