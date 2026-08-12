import { lazy, type LazyExoticComponent, type ComponentType } from 'react'

export type AppId = 'terminal' | 'resume' | 'snake' | 'contra' | 'notes'

export interface AppDefinition {
  id: AppId
  /** Shown on the desktop icon, the title bar and the taskbar button. */
  title: string
  /** Pixel glyph used as the icon; keeps the bundle free of image assets. */
  glyph: string
  accent: string
  defaultSize: { width: number; height: number }
  /** Only one instance may exist — reopening focuses the existing window. */
  singleton?: boolean
  component: LazyExoticComponent<ComponentType>
}

/**
 * Every app is its own lazy chunk (plan §9: none of them load until the
 * visitor actually opens the PC and clicks that icon). The registry is data,
 * so adding an app is one entry here plus the component file.
 */
export const APPS: Record<AppId, AppDefinition> = {
  terminal: {
    id: 'terminal',
    title: 'Terminal.exe',
    glyph: '>_',
    accent: '#4fd6c8',
    defaultSize: { width: 560, height: 380 },
    singleton: true,
    component: lazy(() =>
      import('@/apps/terminal/Terminal').then((m) => ({ default: m.Terminal })),
    ),
  },
  resume: {
    id: 'resume',
    title: 'Resume.pdf',
    glyph: '▤',
    accent: '#f0a848',
    defaultSize: { width: 580, height: 440 },
    singleton: true,
    component: lazy(() =>
      import('@/apps/resume/ResumeViewer').then((m) => ({ default: m.ResumeViewer })),
    ),
  },
  snake: {
    id: 'snake',
    title: 'Snake.exe',
    glyph: '⌇',
    accent: '#4a7c59',
    defaultSize: { width: 420, height: 470 },
    singleton: true,
    component: lazy(() => import('@/apps/snake/Snake').then((m) => ({ default: m.Snake }))),
  },
  contra: {
    id: 'contra',
    title: 'Contra.exe',
    glyph: '⁂',
    accent: '#d64f9a',
    defaultSize: { width: 640, height: 440 },
    singleton: true,
    component: lazy(() => import('@/apps/contra/Contra').then((m) => ({ default: m.Contra }))),
  },
  notes: {
    id: 'notes',
    title: 'readme.txt',
    glyph: '✎',
    accent: '#e8e0d0',
    defaultSize: { width: 440, height: 320 },
    singleton: true,
    component: lazy(() => import('@/apps/notes/Notes').then((m) => ({ default: m.Notes }))),
  },
}

export const DESKTOP_ICON_ORDER: AppId[] = ['terminal', 'resume', 'snake', 'contra', 'notes']
