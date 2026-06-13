import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  CalendarDays,
  Tag,
  AlertCircle,
  Award,
  Flame,
  Search,
  Sliders,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Trophy,
  BarChart3,
  Clock,
  PlusCircle,
  Undo,
  LogOut,
  ShieldCheck,
  Brain,
  Target,
  Zap,
  ArrowLeft,
  ArrowRight,
  Download,
  Upload,
  CalendarPlus,
  CheckCheck
} from 'lucide-react'
import { FlickeringGrid } from '@/components/ui/FlickeringGrid'
import type { Task, SubTask, UserProfile, Category } from './types'
import { KanbanBoard } from './components/KanbanBoard'
import { AnalyticsPanel } from './components/AnalyticsPanel'
import { CommandPalette } from './components/CommandPalette'
import { FocusSpace } from './components/FocusSpace'

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext
  google?: GoogleIdentityServices
}

type SortBy = 'dueDate' | 'priority' | 'createdAt'
type SyncState = 'local' | 'ready' | 'synced'

interface AuthUser {
  id: string
  name: string
  email: string
  picture?: string
  provider: 'google' | 'local'
  lastLoginAt: string
}

interface WorkspaceBackup {
  app: 'aetherflow'
  exportedAt: string
  version: 1
  tasks: Task[]
  categories: Category[]
  profile: UserProfile
}

interface GoogleCredentialResponse {
  credential?: string
  select_by?: string
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      disableAutoSelect: () => void
      initialize: (config: {
        callback: (response: GoogleCredentialResponse) => void
        client_id: string
        use_fedcm_for_prompt?: boolean
      }) => void
      prompt: () => void
      renderButton: (
        parent: HTMLElement,
        options: {
          logo_alignment?: 'left' | 'center'
          shape?: 'rectangular' | 'pill' | 'circle' | 'square'
          size?: 'large' | 'medium' | 'small'
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          theme?: 'outline' | 'filled_blue' | 'filled_black'
          type?: 'standard' | 'icon'
          width?: number
        }
      ) => void
    }
  }
}

interface GoogleJwtPayload {
  email?: string
  name?: string
  picture?: string
  sub?: string
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'inbox', name: 'Inbox', color: '#9ca3af', glowColor: 'rgba(156, 163, 175, 0.2)' },
  { id: 'work', name: 'Work', color: '#71717a', glowColor: 'rgba(113, 113, 122, 0.2)' },
  { id: 'personal', name: 'Personal', color: '#e5e7eb', glowColor: 'rgba(229, 231, 235, 0.2)' },
  { id: 'fitness', name: 'Fitness', color: '#4b5563', glowColor: 'rgba(75, 85, 99, 0.2)' },
  { id: 'ideas', name: 'Ideas', color: '#f3f4f6', glowColor: 'rgba(243, 244, 246, 0.2)' }
]

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

const parseGoogleCredential = (credential: string): GoogleJwtPayload | null => {
  try {
    const [, payload] = credential.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(normalized)) as GoogleJwtPayload
  } catch (error) {
    console.warn('Unable to parse Google credential payload:', error)
    return null
  }
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getMonthMatrix = (cursor: Date) => {
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

const getPriorityWeight = (priority: Task['priority']) => {
  if (priority === 'high') return 3
  if (priority === 'medium') return 2
  return 1
}

const getTaskUrgencyScore = (task: Task, now: number) => {
  if (task.completed) return -1
  const dueScore = task.dueDate
    ? Math.max(0, 7 - Math.floor((new Date(task.dueDate).getTime() - now) / 86400000))
    : 1
  return getPriorityWeight(task.priority) * 10 + dueScore + task.subtasks.filter((sub) => !sub.completed).length
}

const downloadTextFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const escapeIcsText = (value: string) => {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

const makeTaskCalendar = (tasks: Task[]) => {
  const dueTasks = tasks.filter((task) => task.dueDate)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const events = dueTasks.map((task) => {
    const start = task.dueDate.replace(/-/g, '')
    const endDate = new Date(`${task.dueDate}T00:00:00`)
    endDate.setDate(endDate.getDate() + 1)
    const end = toDateKey(endDate).replace(/-/g, '')

    return [
      'BEGIN:VEVENT',
      `UID:${task.id}@aetherflow.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeIcsText(task.title)}`,
      task.description ? `DESCRIPTION:${escapeIcsText(task.description)}` : '',
      `CATEGORIES:${escapeIcsText(task.priority.toUpperCase())}`,
      'END:VEVENT'
    ].filter(Boolean).join('\r\n')
  })

  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aetherflow//Task Calendar//EN', ...events, 'END:VCALENDAR'].join('\r\n')
}

// Audio synthesizer for premium UX sound feedback
const playSynthesizedSound = (type: 'complete' | 'click' | 'levelUp' | 'delete') => {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext

    if (!AudioContextCtor) return

    const ctx = new AudioContextCtor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime

    if (type === 'click') {
      osc.frequency.setValueAtTime(450, now)
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.08)
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.08)
      osc.start(now)
      osc.stop(now + 0.08)
    } else if (type === 'complete') {
      osc.type = 'triangle'
      // Ascending C major arpeggio
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.07) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.14) // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.21) // C6
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.setValueAtTime(0.12, now + 0.21)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35)
      osc.start(now)
      osc.stop(now + 0.35)
    } else if (type === 'delete') {
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.15)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    } else if (type === 'levelUp') {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)

      osc.type = 'sawtooth'
      osc2.type = 'sine'

      // Majestic arpeggio + subharmonic
      osc.frequency.setValueAtTime(261.63, now) // C4
      osc.frequency.setValueAtTime(329.63, now + 0.08) // E4
      osc.frequency.setValueAtTime(392.00, now + 0.16) // G4
      osc.frequency.setValueAtTime(523.25, now + 0.24) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.32) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.40) // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.48) // C6

      osc2.frequency.setValueAtTime(130.81, now) // C3
      osc2.frequency.exponentialRampToValueAtTime(523.25, now + 0.5)

      gain.gain.setValueAtTime(0.08, now)
      gain.gain.linearRampToValueAtTime(0.08, now + 0.48)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.8)

      gain2.gain.setValueAtTime(0.04, now)
      gain2.gain.linearRampToValueAtTime(0.04, now + 0.48)
      gain2.gain.linearRampToValueAtTime(0.001, now + 0.8)

      osc.start(now)
      osc.stop(now + 0.8)
      osc2.start(now)
      osc2.stop(now + 0.8)
    }
  } catch (e) {
    console.warn('AudioContext sound blocked or unsupported:', e)
  }
}

export default function App() {
  // --- STATE DECLARATIONS ---
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const backupInputRef = useRef<HTMLInputElement | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('aether_auth_user')
    return saved ? JSON.parse(saved) : null
  })
  const [syncState, setSyncState] = useState<SyncState>(() => {
    return localStorage.getItem('aether_auth_user') ? 'ready' : 'local'
  })

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('aether_tasks')
    return saved ? JSON.parse(saved) : []
  })

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('aether_categories')
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES
  })

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('aether_profile')
    return saved
      ? JSON.parse(saved)
      : { xp: 0, level: 1, streak: 0, lastCompletedDate: null, totalCompletedTasks: 0 }
  })

  // Grid background customization state
  const [gridColor, setGridColor] = useState<string>('rgb(156, 163, 175)') // Grey / Silver
  const [gridMaxOpacity, setGridMaxOpacity] = useState<number>(0.18)
  const [gridGap, setGridGap] = useState<number>(6)
  const [gridSquareSize, setGridSquareSize] = useState<number>(4)
  const [gridFlickerChance, setGridFlickerChance] = useState<number>(0.35)
  const [showSettings, setShowSettings] = useState<boolean>(false)

  // Floating particles (sparks) for checklist completion click
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; color: string; dx: number; dy: number; size: number; opacity: number }[]>([])

  // Level Up Modal State
  const [showLevelUp, setShowLevelUp] = useState<boolean>(false)
  const [unlockedTitle, setUnlockedTitle] = useState<string>('')

  // Form State
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium')
  const [newCategory, setNewCategory] = useState('inbox')
  const [newDueDate, setNewDueDate] = useState('')
  const [isFormExpanded, setIsFormExpanded] = useState(false)

  // Custom Category Form State
  const [customCatName, setCustomCatName] = useState('')
  const [customCatColor, setCustomCatColor] = useState('#71717a')
  const [showCustomCatForm, setShowCustomCatForm] = useState(false)

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [dueDateFilter, setDueDateFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('createdAt')
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'analytics'>('list')
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false)
  const [showFocusMode, setShowFocusMode] = useState<boolean>(false)
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null)

  // Expanded/Editing Task Details State
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPriority, setEditPriority] = useState<Task['priority']>('medium')
  const [editCategory, setEditCategory] = useState('')
  const [editDueDate, setEditDueDate] = useState('')

  // Subtask creation state per expanded task
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  // Time & Date State
  const [currentTime, setCurrentTime] = useState(new Date())
  const [calendarCursor, setCalendarCursor] = useState(() => new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toDateKey(new Date()))

  // Scroll State for top header Dock transition
  const [isScrolled, setIsScrolled] = useState(false)

  // Context Menu State for Category Filters
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    categoryId: string
  } | null>(null)

  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null)
  const [renamingName, setRenamingName] = useState<string>('')

  const handleGoogleCredential = useCallback((response: GoogleCredentialResponse) => {
    if (!response.credential) return
    const payload = parseGoogleCredential(response.credential)
    if (!payload?.sub || !payload.email) return

    const nextUser: AuthUser = {
      id: payload.sub,
      name: payload.name || payload.email.split('@')[0],
      email: payload.email,
      picture: payload.picture,
      provider: 'google',
      lastLoginAt: new Date().toISOString()
    }

    playSynthesizedSound('complete')
    setAuthUser(nextUser)
    setSyncState('ready')
  }, [])

  const handleLocalWorkspace = useCallback(() => {
    playSynthesizedSound('click')
    setAuthUser({
      id: 'local-workspace',
      name: 'Local Workspace',
      email: 'stored on this device',
      provider: 'local',
      lastLoginAt: new Date().toISOString()
    })
    setSyncState('local')
  }, [])

  const handleSignOut = useCallback(() => {
    playSynthesizedSound('click')
    ;(window as WindowWithWebkitAudioContext).google?.accounts.id.disableAutoSelect()
    setAuthUser(null)
    setSyncState('local')
  }, [])

  const handleExportBackup = () => {
    playSynthesizedSound('click')
    const backup: WorkspaceBackup = {
      app: 'aetherflow',
      categories,
      exportedAt: new Date().toISOString(),
      profile,
      tasks,
      version: 1
    }
    downloadTextFile(`aetherflow-backup-${toDateKey(new Date())}.json`, JSON.stringify(backup, null, 2), 'application/json')
  }

  const handleImportBackup = (file: File | null) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const backup = JSON.parse(String(reader.result)) as WorkspaceBackup
        if (backup.app !== 'aetherflow' || !Array.isArray(backup.tasks) || !Array.isArray(backup.categories)) {
          throw new Error('Invalid Aetherflow backup file.')
        }

        playSynthesizedSound('complete')
        setTasks(backup.tasks)
        setCategories(backup.categories.length > 0 ? backup.categories : DEFAULT_CATEGORIES)
        setProfile(backup.profile)
        setExpandedTaskId(null)
        setEditingTaskId(null)
      } catch (error) {
        console.warn('Backup import failed:', error)
        window.alert('That file is not a valid Aetherflow backup.')
      } finally {
        if (backupInputRef.current) backupInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  const handleExportCalendar = () => {
    playSynthesizedSound('click')
    downloadTextFile(`aetherflow-calendar-${toDateKey(new Date())}.ics`, makeTaskCalendar(tasks), 'text/calendar')
  }

  const handleClearCompleted = () => {
    const completedCount = tasks.filter((task) => task.completed).length
    if (completedCount === 0) return
    playSynthesizedSound('delete')
    setTasks((prev) => prev.filter((task) => !task.completed))
  }

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    if (authUser) {
      localStorage.setItem('aether_auth_user', JSON.stringify(authUser))
    } else {
      localStorage.removeItem('aether_auth_user')
    }
  }, [authUser])

  useEffect(() => {
    localStorage.setItem('aether_tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('aether_categories', JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    localStorage.setItem('aether_profile', JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    if (!authUser) return
    const readyTimer = window.setTimeout(() => setSyncState('ready'), 0)
    const syncTimer = window.setTimeout(() => setSyncState('synced'), 450)
    return () => {
      window.clearTimeout(readyTimer)
      window.clearTimeout(syncTimer)
    }
  }, [authUser, tasks, categories, profile])

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return

    const googleWindow = window as WindowWithWebkitAudioContext
    let cancelled = false

    const initializeGoogle = () => {
      if (cancelled || !googleWindow.google || !googleButtonRef.current) return

      googleButtonRef.current.innerHTML = ''
      googleWindow.google.accounts.id.initialize({
        callback: handleGoogleCredential,
        client_id: googleClientId,
        use_fedcm_for_prompt: true
      })
      googleWindow.google.accounts.id.renderButton(googleButtonRef.current, {
        logo_alignment: 'left',
        shape: 'pill',
        size: 'large',
        text: 'continue_with',
        theme: 'outline',
        type: 'standard',
        width: 280
      })
    }

    if (googleWindow.google) {
      initializeGoogle()
      return () => {
        cancelled = true
      }
    }

    const existingScript = document.getElementById('google-identity-services')
    if (existingScript) {
      existingScript.addEventListener('load', initializeGoogle, { once: true })
      return () => {
        cancelled = true
        existingScript.removeEventListener('load', initializeGoogle)
      }
    }

    const script = document.createElement('script')
    script.id = 'google-identity-services'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.addEventListener('load', initializeGoogle, { once: true })
    document.head.appendChild(script)

    return () => {
      cancelled = true
      script.removeEventListener('load', initializeGoogle)
    }
  }, [handleGoogleCredential, authUser])

  // Current Date Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Header Scroll Listener with Hysteresis to prevent jitter/flickering
  useEffect(() => {
    let scrolled = false
    const handleScroll = () => {
      const sy = window.scrollY
      if (!scrolled && sy > 50) {
        scrolled = true
        setIsScrolled(true)
      } else if (scrolled && sy < 20) {
        scrolled = false
        setIsScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Global event listeners to close Category context menu
  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu(null)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
      }
    }
    window.addEventListener('click', handleCloseMenu)
    window.addEventListener('contextmenu', handleCloseMenu)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleCloseMenu)
      window.removeEventListener('contextmenu', handleCloseMenu)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Global keyboard shortcut for Command Palette (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        playSynthesizedSound('click')
        setShowCommandPalette((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Animate particles (sparks)
  useEffect(() => {
    if (sparks.length === 0) return
    const frame = requestAnimationFrame(() => {
      setSparks((prev) =>
        prev
          .map((s) => ({
            ...s,
            x: s.x + s.dx,
            y: s.y + s.dy,
            dy: s.dy + 0.18, // Gravity
            opacity: s.opacity - 0.04
          }))
          .filter((s) => s.opacity > 0)
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [sparks])

  // Get user level Title
  const getLevelTitle = (lvl: number) => {
    if (lvl === 1) return 'Aether Initiate'
    if (lvl === 2) return 'Focus Adept'
    if (lvl === 3) return 'System Architect'
    if (lvl === 4) return 'Flow Commander'
    if (lvl === 5) return 'Temporal Vanguard'
    if (lvl === 6) return 'Efficiency Sentinel'
    return 'Aether Grandmaster'
  }

  // --- PARTICLE EMITTER ---
  const emitSparks = (x: number, y: number, color: string) => {
    const colors = [color, '#ffffff', '#e5e7eb', '#9ca3af', '#4b5563']
    const newSparks = Array.from({ length: 18 }).map(() => {
      const angle = Math.random() * Math.PI * 2
      const speed = 1.5 + Math.random() * 4.5
      return {
        id: Math.random() + Date.now(),
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed - 1.5, // Initial upward burst
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 5,
        opacity: 1
      }
    })
    setSparks((prev) => [...prev, ...newSparks])
  }

  // --- GAME MECHANICS: XP AND STREAK ---
  const handleXPGain = (xpAmount: number) => {
    setProfile((prev) => {
      let newXp = prev.xp + xpAmount
      let newLvl = prev.level
      const xpNeeded = newLvl * 100

      let leveledUp = false
      if (newXp >= xpNeeded) {
        newXp -= xpNeeded
        newLvl += 1
        leveledUp = true
      }

      if (leveledUp) {
        setTimeout(() => {
          playSynthesizedSound('levelUp')
          setUnlockedTitle(getLevelTitle(newLvl))
          setShowLevelUp(true)
        }, 300)
      }

      return {
        ...prev,
        xp: newXp,
        level: newLvl,
        totalCompletedTasks: prev.totalCompletedTasks + 1
      }
    })
  }

  const updateStreak = () => {
    const todayStr = new Date().toDateString()
    setProfile((prev) => {
      if (prev.lastCompletedDate === todayStr) {
        return prev // Already completed a task today, streak unchanged
      }

      let newStreak = prev.streak
      if (prev.lastCompletedDate) {
        const lastDate = new Date(prev.lastCompletedDate)
        const today = new Date(todayStr)
        const diffTime = Math.abs(today.getTime() - lastDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays === 1) {
          newStreak += 1
        } else if (diffDays > 1) {
          newStreak = 1 // Reset to 1 day since they missed days
        }
      } else {
        newStreak = 1 // First task completed ever
      }

      return {
        ...prev,
        streak: newStreak,
        lastCompletedDate: todayStr
      }
    })
  }

  // --- TASK CRUD OPERATIONS ---
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    playSynthesizedSound('click')

    let xpReward = 15 // Medium priority standard reward
    if (newPriority === 'high') xpReward = 30
    if (newPriority === 'low') xpReward = 10

    const newTask: Task = {
      id: Math.random().toString(36).substring(2, 9),
      title: newTitle,
      description: newDesc,
      priority: newPriority,
      category: newCategory,
      dueDate: newDueDate,
      completed: false,
      subtasks: [],
      xpReward,
      createdAt: new Date().toISOString()
    }

    setTasks((prev) => [newTask, ...prev])
    setNewTitle('')
    setNewDesc('')
    setNewPriority('medium')
    setNewDueDate('')
    setIsFormExpanded(false)
  }

  const handleToggleComplete = (e: React.MouseEvent | null | undefined, id: string) => {
    if (e) e.stopPropagation()
    const task = tasks.find((t) => t.id === id)
    if (!task) return

    const newCompleted = !task.completed
    playSynthesizedSound(newCompleted ? 'complete' : 'click')

    if (newCompleted) {
      // Complete: spawn particle explosion at the mouse cursor coordinate
      if (e) {
        emitSparks(e.clientX, e.clientY, '#ffffff')
      } else {
        emitSparks(window.innerWidth / 2, window.innerHeight / 2, '#ffffff')
      }
      handleXPGain(task.xpReward)
      updateStreak()
    } else {
      // Re-opening task: deduct XP (allow going down to 0 but not negative levels)
      setProfile((prev) => ({
        ...prev,
        xp: Math.max(0, prev.xp - task.xpReward),
        totalCompletedTasks: Math.max(0, prev.totalCompletedTasks - 1)
      }))
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: newCompleted } : t))
    )
  }

  const handleDeleteTask = (e: React.MouseEvent | null | undefined, id: string) => {
    if (e) e.stopPropagation()
    playSynthesizedSound('delete')
    setTasks((prev) => prev.filter((t) => t.id !== id))
    if (expandedTaskId === id) setExpandedTaskId(null)
    if (editingTaskId === id) setEditingTaskId(null)
  }

  const handleTaskColumnChange = (taskId: string, targetColumn: 'todo' | 'in_progress' | 'completed') => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const prevCompleted = task.completed

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          if (targetColumn === 'completed') {
            return { ...t, completed: true, inProgress: false }
          } else if (targetColumn === 'in_progress') {
            return { ...t, completed: false, inProgress: true }
          } else {
            return { ...t, completed: false, inProgress: false }
          }
        }
        return t
      })
    )

    if (targetColumn === 'completed' && !prevCompleted) {
      playSynthesizedSound('complete')
      emitSparks(window.innerWidth / 2, window.innerHeight / 2, '#ffffff')
      handleXPGain(task.xpReward)
      updateStreak()
    } else if (targetColumn !== 'completed' && prevCompleted) {
      playSynthesizedSound('click')
      setProfile((prev) => ({
        ...prev,
        xp: Math.max(0, prev.xp - task.xpReward),
        totalCompletedTasks: Math.max(0, prev.totalCompletedTasks - 1)
      }))
    } else {
      playSynthesizedSound('click')
    }
  }

  const handleQuickAddTask = (title: string) => {
    playSynthesizedSound('click')
    const newTask: Task = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      description: '',
      priority: 'medium',
      category: 'inbox',
      dueDate: '',
      completed: false,
      subtasks: [],
      xpReward: 15,
      createdAt: new Date().toISOString()
    }
    setTasks((prev) => [newTask, ...prev])
  }



  // --- SUBTASKS HANDLERS ---
  const handleAddSubtask = (taskId: string) => {
    if (!newSubtaskTitle.trim()) return
    playSynthesizedSound('click')

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const newSub: SubTask = {
            id: Math.random().toString(36).substring(2, 9),
            title: newSubtaskTitle,
            completed: false
          }
          return {
            ...t,
            subtasks: [...t.subtasks, newSub]
          }
        }
        return t
      })
    )
    setNewSubtaskTitle('')
  }

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    playSynthesizedSound('click')
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updatedSubs = t.subtasks.map((sub) =>
            sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
          )
          return {
            ...t,
            subtasks: updatedSubs
          }
        }
        return t
      })
    )
  }

  const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
    playSynthesizedSound('delete')
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: t.subtasks.filter((s) => s.id !== subtaskId)
          }
        }
        return t
      })
    )
  }

  // --- EDIT TASK HANDLERS ---
  const startEditing = (task: Task) => {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditDesc(task.description)
    setEditPriority(task.priority)
    setEditCategory(task.category)
    setEditDueDate(task.dueDate)
  }

  const handleSaveEdit = (taskId: string) => {
    playSynthesizedSound('click')
    let xpReward = 15
    if (editPriority === 'high') xpReward = 30
    if (editPriority === 'low') xpReward = 10

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              title: editTitle,
              description: editDesc,
              priority: editPriority,
              category: editCategory,
              dueDate: editDueDate,
              xpReward
            }
          : t
      )
    )
    setEditingTaskId(null)
  }

  // --- CUSTOM CATEGORIES ---
  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customCatName.trim()) return

    playSynthesizedSound('click')

    // Create a glow hex code helper (30% opacity)
    const glow = customCatColor.startsWith('#')
      ? `rgba(${parseInt(customCatColor.slice(1, 3), 16)}, ${parseInt(customCatColor.slice(3, 5), 16)}, ${parseInt(customCatColor.slice(5, 7), 16)}, 0.4)`
      : 'rgba(168, 85, 247, 0.4)'

    const newCat: Category = {
      id: customCatName.toLowerCase().replace(/\s+/g, '-'),
      name: customCatName,
      color: customCatColor,
      glowColor: glow
    }

    setCategories((prev) => [...prev, newCat])
    setCustomCatName('')
    setShowCustomCatForm(false)
  }

  const handleRenameCategory = (id: string, newName: string) => {
    if (!newName.trim()) {
      setRenamingCategoryId(null)
      return
    }
    playSynthesizedSound('click')
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: newName.trim() } : c))
    )
    setRenamingCategoryId(null)
  }

  const handleDeleteCategory = (id: string) => {
    if (id === 'inbox') return // Protected
    playSynthesizedSound('delete')
    setCategories((prev) => prev.filter((c) => c.id !== id))
    // Move tasks to default 'inbox' if their category is deleted
    setTasks((prev) =>
      prev.map((t) => (t.category === id ? { ...t, category: 'inbox' } : t))
    )
    if (selectedCategoryFilter === id) {
      setSelectedCategoryFilter('all')
    }
  }

  const handleToggleDisableCategory = (id: string) => {
    if (id === 'inbox') return // Protected
    playSynthesizedSound('click')
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, disabled: !c.disabled } : c))
    )
    // If we are disabling the currently selected category filter, fallback to 'all'
    const target = categories.find((c) => c.id === id)
    if (target && !target.disabled && selectedCategoryFilter === id) {
      setSelectedCategoryFilter('all')
    }
  }

  // --- COMPUTED PROPERTIES & STATS ---
  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryFilter)
  }, [categories, selectedCategoryFilter])

  const stats = useMemo(() => {
    const today = currentTime.toDateString()
    const now = currentTime.getTime()
    const todayTasks = tasks.filter((t) => new Date(t.createdAt).toDateString() === today)
    const todayCompleted = todayTasks.filter((t) => t.completed)
    const completionRate = todayTasks.length > 0 ? Math.round((todayCompleted.length / todayTasks.length) * 100) : 0

    const highPriorityActive = tasks.filter((t) => !t.completed && t.priority === 'high').length
    const overdueTasks = tasks.filter((t) => {
      if (t.completed || !t.dueDate) return false
      const due = new Date(t.dueDate)
      due.setHours(23, 59, 59, 999) // End of day
      return due.getTime() < now
    }).length

    return {
      todayCount: todayTasks.length,
      todayCompleted: todayCompleted.length,
      completionRate,
      highPriorityActive,
      overdueTasks,
      totalActive: tasks.filter((t) => !t.completed).length,
      totalCompleted: tasks.filter((t) => t.completed).length
    }
  }, [tasks, currentTime])

  const calendarDays = useMemo(() => getMonthMatrix(calendarCursor), [calendarCursor])

  const tasksByDueDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {}
    tasks.forEach((task) => {
      if (!task.dueDate) return
      grouped[task.dueDate] = [...(grouped[task.dueDate] || []), task]
    })
    return grouped
  }, [tasks])

  const selectedDateTasks = tasksByDueDate[selectedCalendarDate] || []

  const focusQueue = useMemo(() => {
    const now = currentTime.getTime()
    return [...tasks]
      .filter((task) => !task.completed)
      .sort((a, b) => getTaskUrgencyScore(b, now) - getTaskUrgencyScore(a, now))
      .slice(0, 3)
  }, [tasks, currentTime])

  const intelligence = useMemo(() => {
    const todayKey = toDateKey(currentTime)
    const nextSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(currentTime)
      date.setDate(currentTime.getDate() + index)
      return toDateKey(date)
    })
    const dueThisWeek = tasks.filter((task) => !task.completed && task.dueDate && nextSevenDays.includes(task.dueDate)).length
    const dueToday = tasks.filter((task) => !task.completed && task.dueDate === todayKey).length
    const blockedBySubtasks = tasks.filter(
      (task) => !task.completed && task.subtasks.length > 0 && task.subtasks.every((subtask) => !subtask.completed)
    ).length
    const pressure = stats.overdueTasks * 3 + dueToday * 2 + dueThisWeek + stats.highPriorityActive * 2
    const grade = pressure > 18 ? 'Critical' : pressure > 10 ? 'Elevated' : pressure > 4 ? 'Steady' : 'Clear'

    return {
      blockedBySubtasks,
      dueThisWeek,
      dueToday,
      grade,
      pressure
    }
  }, [tasks, currentTime, stats.highPriorityActive, stats.overdueTasks])

  // Category task counter mapping
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    categories.forEach((cat) => {
      counts[cat.id] = tasks.filter((t) => !t.completed && t.category === cat.id).length
    })
    return counts
  }, [tasks, categories])

  // Filtered and Sorted Tasks list
  const filteredTasks = useMemo(() => {
    const disabledCategoryIds = new Set(
      categories.filter((c) => c.disabled).map((c) => c.id)
    )

    return tasks
      .filter((task) => {
        // Hide tasks belonging to a disabled category unless it is explicitly selected as the active filter
        if (disabledCategoryIds.has(task.category) && selectedCategoryFilter !== task.category) {
          return false
        }

        // Search Filter
        const matchesSearch =
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description.toLowerCase().includes(searchQuery.toLowerCase())

        // Status Filter
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && !task.completed) ||
          (statusFilter === 'completed' && task.completed)

        // Priority Filter
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter

        // Category Filter
        const matchesCategory =
          selectedCategoryFilter === 'all' || task.category === selectedCategoryFilter
        const matchesDueDate = !dueDateFilter || task.dueDate === dueDateFilter

        return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesDueDate
      })
      .sort((a, b) => {
        if (sortBy === 'dueDate') {
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        }
        if (sortBy === 'priority') {
          const priorityWeights = { high: 3, medium: 2, low: 1 }
          return priorityWeights[b.priority] - priorityWeights[a.priority]
        }
        // Default: createdAt newest first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [tasks, categories, searchQuery, statusFilter, priorityFilter, selectedCategoryFilter, dueDateFilter, sortBy])

  // Render SVG circular progress bar logic
  const circleRadius = 35
  const circleCircumference = 2 * Math.PI * circleRadius
  const circleDashOffset = circleCircumference - (stats.completionRate / 100) * circleCircumference

  if (!authUser) {
    return (
      <div className="relative min-h-screen bg-[#000000] text-gray-200 overflow-x-hidden font-sans antialiased flex items-center justify-center p-4 selection:bg-zinc-500/30 selection:text-zinc-300">
        {/* Canvas Flickering Grid Background */}
        <div className="fixed inset-0 w-full h-full z-0 pointer-events-none opacity-40 transition-opacity duration-700">
          <FlickeringGrid
            color={gridColor}
            maxOpacity={gridMaxOpacity}
            gridGap={gridGap}
            squareSize={gridSquareSize}
            flickerChance={gridFlickerChance}
          />
        </div>

        {/* Auth Gate Panel */}
        <div className="relative z-10 w-full max-w-md glass-card rounded-3xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/10 animate-scale-in">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-300/30 to-transparent pointer-events-none" />

          {/* Glowing Brand Icon */}
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-zinc-700 to-zinc-400 shadow-[0_0_30px_rgba(255,255,255,0.15)]">
              <Sparkles className="h-8 w-8 text-white animate-pulse" />
            </div>
          </div>

          {/* Title / Description */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-gradient font-heading m-0 leading-none">
              AETHERFLOW
            </h1>
            <p className="mt-2 text-xs text-zinc-400 font-mono tracking-wider">
              Productivity Engine v4.3
            </p>
            <p className="mt-4 text-sm text-zinc-500 leading-relaxed max-w-xs mx-auto">
              A premium local-first task manager and gamified productivity space.
            </p>
          </div>

          {/* Action Surface */}
          <div className="space-y-4">
            {googleClientId ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-full flex justify-center min-h-[44px] overflow-hidden rounded-full border border-white/10 bg-white/2 p-0.5" ref={googleButtonRef} />
                <div className="flex items-center w-full gap-3 py-1">
                  <div className="h-px bg-white/5 flex-grow" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">or</span>
                  <div className="h-px bg-white/5 flex-grow" />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-center text-xs leading-relaxed text-zinc-400">
                <p className="font-semibold text-zinc-300 mb-1">Cloud Sync Info</p>
                To enable Google Authentication, add your <code className="font-mono text-zinc-300 text-[10px] bg-white/5 px-1 py-0.5 rounded">VITE_GOOGLE_CLIENT_ID</code> inside the <code className="font-mono text-zinc-300 text-[10px] bg-white/5 px-1 py-0.5 rounded">.env</code> file.
              </div>
            )}

            <button
              type="button"
              onClick={handleLocalWorkspace}
              className="interactive-control flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-zinc-200 transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:text-white shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_25px_rgba(255,255,255,0.05)] hover:scale-[1.01] active:scale-[0.99]"
            >
              <ShieldCheck className="h-5 w-5 text-zinc-400" />
              Access Local Workspace
            </button>
          </div>

          {/* Footer Specifications */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-zinc-500">
            <span>Local-first</span>
            <span>60 FPS Motion</span>
            <span>V4.3</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[#000000] text-gray-200 overflow-x-hidden font-sans antialiased pb-16 selection:bg-zinc-500/30 selection:text-zinc-300">
      {/* Spacer to prevent page content layout shift/jump due to fixed header positioning */}
      <div className="h-[136px] md:h-[73px]" />
      {/* Canvas Flickering Grid Background */}
      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none opacity-40 transition-opacity duration-700">
        <FlickeringGrid
          color={gridColor}
          maxOpacity={gridMaxOpacity}
          gridGap={gridGap}
          squareSize={gridSquareSize}
          flickerChance={gridFlickerChance}
        />
      </div>

      {/* Global Particle Emitter Overlay */}
      {sparks.map((spark) => (
        <div
          key={spark.id}
          className="fixed pointer-events-none rounded-full z-50 -translate-x-1/2 -translate-y-1/2 transition-transform duration-150 ease-out"
          style={{
            left: spark.x,
            top: spark.y,
            width: spark.size,
            height: spark.size,
            backgroundColor: spark.color,
            opacity: spark.opacity,
            boxShadow: `0 0 ${spark.size * 2}px ${spark.color}`
          }}
        />
      ))}

      {/* --- APPLICATION HEADER --- */}
      <header
        className={`fixed left-1/2 -translate-x-1/2 z-40 transition-all duration-500 ease-out flex flex-row items-center justify-between gap-4 border ${
          isScrolled
            ? 'top-3 w-[92%] max-w-5xl rounded-2xl border-white/10 bg-black/65 backdrop-blur-xl px-5 py-2 sm:py-2.5 shadow-[0_15px_35px_rgba(0,0,0,0.85),_0_0_20px_rgba(255,255,255,0.03)]'
            : 'top-0 w-full max-w-[100vw] rounded-none border-white/5 border-t-transparent border-x-transparent bg-black/35 backdrop-blur-md px-6 py-4 md:px-12'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center rounded-xl bg-gradient-to-tr from-zinc-700 to-zinc-400 shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all duration-500 ${
            isScrolled ? 'h-8 w-8' : 'h-10 w-10'
          }`}>
            <Sparkles className={`text-white transition-all duration-500 ${isScrolled ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </div>
          <div>
            <h1 className={`font-bold tracking-tight text-gradient font-heading m-0 leading-none transition-all duration-500 ${
              isScrolled ? 'text-lg' : 'text-2xl'
            }`}>
              AETHERFLOW
            </h1>
            <span className={`block text-xs text-zinc-400/80 font-mono tracking-wider overflow-hidden transition-all duration-500 ${
              isScrolled ? 'max-h-0 opacity-0 mt-0' : 'max-h-5 opacity-100 mt-1'
            }`}>
              Productivity Engine v4.3
            </span>
          </div>
        </div>

        {/* Real-time date display and streak */}
        <div className="flex items-center gap-3 md:gap-6 transition-all duration-500">
          <div className={`flex items-center gap-1.5 font-mono text-zinc-300 transition-all duration-500 border border-white/5 ${
            isScrolled
              ? 'px-2.5 py-1 rounded-lg bg-white/2 text-xs'
              : 'px-3 py-1.5 rounded-lg bg-white/3 text-sm'
          }`}>
            <Clock className={`text-zinc-400 transition-all duration-500 ${isScrolled ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
            <span className="font-semibold">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: (isScrolled ? undefined : '2-digit') })}</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">{currentTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
          </div>

          <div className={`flex items-center gap-1.5 text-zinc-300 shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all duration-500 border border-zinc-700 ${
            isScrolled
              ? 'px-2.5 py-1 rounded-lg bg-zinc-800/10'
              : 'px-3 py-1.5 rounded-lg bg-zinc-800/20'
          }`}>
            <Flame className={`text-zinc-300 fill-zinc-400/35 animate-bounce transition-all duration-500 ${isScrolled ? 'h-[18px] w-[18px]' : 'h-5 w-5'}`} />
            <span className={`font-bold font-heading transition-all duration-500 ${isScrolled ? 'text-base' : 'text-lg'}`}>{profile.streak}</span>
            <span className={`text-[10px] text-zinc-400/70 font-mono transition-all duration-500 ${
              isScrolled ? 'hidden md:inline' : 'inline'
            }`}>
              DAY STREAK
            </span>
          </div>

          {authUser && (
            <div className={`hidden md:flex items-center gap-2 border border-white/5 bg-white/3 transition-all duration-500 ${
              isScrolled ? 'px-2 py-1 rounded-lg' : 'px-2.5 py-1.5 rounded-xl'
            }`}>
              {authUser.picture ? (
                <img src={authUser.picture} alt="" className="h-6 w-6 rounded-full border border-white/10" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-white">
                  {authUser.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="max-w-[130px] leading-none">
                <span className="block truncate text-xs font-semibold text-zinc-200">{authUser.name}</span>
                <span className="block text-[9px] uppercase tracking-wide text-zinc-500">{syncState}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* --- DASHBOARD GRID --- */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR: NAVIGATION & METRICS (4 columns) */}
        <section className="lg:col-span-4 flex flex-col gap-6">

          {/* ACCOUNT & SYNC SURFACE */}
          <div className="glass-card motion-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-300/30 to-transparent pointer-events-none" />

            {authUser && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  {authUser.picture ? (
                    <img src={authUser.picture} alt="" className="h-12 w-12 rounded-2xl border border-white/10" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-lg font-bold text-white">
                      {authUser.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-white">{authUser.name}</h3>
                    <p className="truncate text-xs text-zinc-500">{authUser.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[10px] uppercase">
                  <div className="stat-tile rounded-xl border border-white/5 p-2 text-center">
                    <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-zinc-300" />
                    <span className="block text-zinc-500">Auth</span>
                    <span className="text-zinc-200">{authUser.provider === 'google' ? 'Google' : 'Local'}</span>
                  </div>
                  <div className="stat-tile rounded-xl border border-white/5 p-2 text-center">
                    <Zap className="mx-auto mb-1 h-4 w-4 text-zinc-300" />
                    <span className="block text-zinc-500">Sync</span>
                    <span className="text-zinc-200">{syncState}</span>
                  </div>
                  <div className="stat-tile rounded-xl border border-white/5 p-2 text-center">
                    <Target className="mx-auto mb-1 h-4 w-4 text-zinc-300" />
                    <span className="block text-zinc-500">Focus</span>
                    <span className="text-zinc-200">{focusQueue.length}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="interactive-control flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/2 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* WORKSPACE TOOLS */}
          <div className="glass-card motion-card rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-white font-semibold text-base font-heading flex items-center gap-2">
                <Zap className="h-4 w-4 text-zinc-400" />
                Workspace Tools
              </h4>
              <span className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">Local-first</span>
            </div>

            <input
              ref={backupInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => handleImportBackup(event.target.files?.[0] || null)}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="interactive-control flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/2 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                <Download className="h-4 w-4" />
                Backup
              </button>
              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="interactive-control flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/2 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                <Upload className="h-4 w-4" />
                Restore
              </button>
              <button
                type="button"
                onClick={handleExportCalendar}
                className="interactive-control flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/2 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                <CalendarPlus className="h-4 w-4" />
                Calendar
              </button>
              <button
                type="button"
                onClick={handleClearCompleted}
                className="interactive-control flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/2 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                <CheckCheck className="h-4 w-4" />
                Clear Done
              </button>
            </div>
          </div>
          
          {/* USER PROFILE & LEVEL SYSTEM */}
          <div className="glass-card motion-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

            <div className="flex items-center gap-4">
              {/* Level Circle Display */}
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/3 border-2 border-zinc-500/50 shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-transform duration-300 ease-out hover:scale-[1.03]">
                <Trophy className="absolute -top-2 -right-2 h-5 w-5 text-zinc-400 fill-zinc-500/50 rotate-12" />
                <div className="text-center">
                  <span className="block text-2xl font-bold font-heading text-white">{profile.level}</span>
                  <span className="block text-[8px] text-zinc-400 font-mono uppercase tracking-wider font-semibold">Level</span>
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold text-lg leading-snug">{getLevelTitle(profile.level)}</h3>
                <p className="text-xs text-gray-400 font-mono uppercase">User Core Level</p>
              </div>
            </div>

            {/* XP progress bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs font-mono text-gray-400 mb-1.5">
                <span>XP PROGRESS</span>
                <span className="text-zinc-300 font-bold">
                  {profile.xp} / {profile.level * 100} XP
                </span>
              </div>
              <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-zinc-700 to-zinc-300 rounded-full transition-all duration-500"
                  style={{ width: `${(profile.xp / (profile.level * 100)) * 100}%` }}
                />
              </div>
            </div>

            {/* Core Stats Overview */}
            <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-white/5 font-mono">
              <div className="stat-tile rounded-xl p-3 border border-white/5 text-center">
                <span className="block text-xs text-gray-400 uppercase">Completed</span>
                <span className="text-xl font-bold text-white font-heading">{profile.totalCompletedTasks}</span>
              </div>
              <div className="stat-tile rounded-xl p-3 border border-white/5 text-center">
                <span className="block text-xs text-gray-400 uppercase">Active</span>
                <span className="text-xl font-bold text-zinc-300 font-heading">{stats.totalActive}</span>
              </div>
            </div>
          </div>

          {/* DAILY PRODUCTIVITY METRIC */}
          <div className="glass-card motion-card rounded-2xl p-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-white font-semibold text-base font-heading">Today's Flow Rate</h4>
              <p className="text-xs text-gray-400 max-w-[160px]">Percentage of tasks completed today.</p>
              <div className="flex items-center gap-1.5 mt-2 font-mono text-xs text-zinc-400">
                <BarChart3 className="h-3.5 w-3.5 text-zinc-400" />
                <span>{stats.todayCompleted} of {stats.todayCount} Tasks</span>
              </div>
            </div>

            {/* Circular Progress Bar */}
            <div className="relative h-20 w-20 flex items-center justify-center">
              <svg className="h-20 w-20 transform -rotate-90" viewBox="0 0 80 80">
                {/* Track Circle */}
                <circle
                  cx="40"
                  cy="40"
                  r={circleRadius}
                  className="stroke-zinc-700/50 fill-transparent"
                  strokeWidth="5"
                />
                {/* Progress Circle */}
                <circle
                  cx="40"
                  cy="40"
                  r={circleRadius}
                  className="stroke-white fill-transparent transition-all duration-500 ease-out"
                  strokeWidth="5"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={circleDashOffset}
                  strokeLinecap="round"
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.35))'
                  }}
                />
              </svg>
              <span className="absolute text-sm font-bold font-heading text-white">{stats.completionRate}%</span>
            </div>
          </div>

          {/* SMART CALENDAR */}
          <div className="glass-card motion-card rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-base font-semibold text-white font-heading">
                <CalendarDays className="h-4 w-4 text-zinc-400" />
                Calendar
              </h4>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    playSynthesizedSound('click')
                    setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }}
                  className="icon-control rounded-lg border border-white/5 bg-white/2 p-1.5 text-zinc-400 hover:text-white"
                  aria-label="Previous month"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSynthesizedSound('click')
                    const today = new Date()
                    setCalendarCursor(today)
                    setSelectedCalendarDate(toDateKey(today))
                    setDueDateFilter(toDateKey(today))
                  }}
                  className="interactive-control rounded-lg border border-white/5 bg-white/2 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 hover:text-white"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSynthesizedSound('click')
                    setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }}
                  className="icon-control rounded-lg border border-white/5 bg-white/2 p-1.5 text-zinc-400 hover:text-white"
                  aria-label="Next month"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mb-3 flex items-end justify-between">
              <div>
                <span className="block text-xl font-bold text-white font-heading">
                  {calendarCursor.toLocaleDateString([], { month: 'long' })}
                </span>
                <span className="text-xs font-mono text-zinc-500">{calendarCursor.getFullYear()}</span>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-right">
                <span className="block text-lg font-bold text-white font-heading">{selectedDateTasks.length}</span>
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">due selected</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono uppercase tracking-wide text-zinc-600">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {calendarDays.map((date) => {
                const dateKey = toDateKey(date)
                const dayTasks = tasksByDueDate[dateKey] || []
                const isCurrentMonth = date.getMonth() === calendarCursor.getMonth()
                const isToday = dateKey === toDateKey(currentTime)
                const isSelected = dateKey === selectedCalendarDate
                const activeCount = dayTasks.filter((task) => !task.completed).length

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      playSynthesizedSound('click')
                      setSelectedCalendarDate(dateKey)
                      setDueDateFilter(dateKey)
                    }}
                    className={`interactive-control relative flex aspect-square min-h-9 flex-col items-center justify-center rounded-xl border text-xs font-semibold ${
                      isSelected
                        ? 'border-zinc-300 bg-zinc-200 text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.12)]'
                        : isToday
                          ? 'border-zinc-500/60 bg-zinc-800/50 text-white'
                          : 'border-white/5 bg-white/2 text-zinc-400 hover:border-white/15 hover:text-white'
                    } ${isCurrentMonth ? '' : 'opacity-35'}`}
                  >
                    <span>{date.getDate()}</span>
                    {activeCount > 0 && (
                      <span className={`mt-1 h-1.5 rounded-full ${activeCount > 2 ? 'w-4' : 'w-1.5'} ${
                        isSelected ? 'bg-zinc-950' : 'bg-zinc-300'
                      }`} />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  {new Date(selectedCalendarDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                {dueDateFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      playSynthesizedSound('click')
                      setDueDateFilter(null)
                    }}
                    className="icon-control text-zinc-500 hover:text-white"
                    aria-label="Clear calendar filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {selectedDateTasks.length === 0 ? (
                  <p className="text-xs text-zinc-600">No due tasks on this date.</p>
                ) : (
                  selectedDateTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        playSynthesizedSound('click')
                        setExpandedTaskId(task.id)
                      }}
                      className="interactive-control flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/2 px-3 py-2 text-left"
                    >
                      <span className={`truncate text-xs ${task.completed ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>{task.title}</span>
                      <span className="text-[10px] uppercase text-zinc-500">{task.priority}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* CATEGORIES SELECTION & DYNAMIC MANAGER */}
          <div id="category-filters-card" className="glass-card motion-card rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-white font-semibold text-base font-heading flex items-center gap-2">
                <Tag className="h-4 w-4 text-zinc-400" />
                Category Filters
              </h4>
              <button
                onClick={() => {
                  playSynthesizedSound('click')
                  setShowCustomCatForm(!showCustomCatForm)
                }}
                className="interactive-control text-xs text-zinc-400 hover:text-zinc-300 font-mono flex items-center gap-1 bg-zinc-800/10 hover:bg-zinc-800/20 px-2 py-1 rounded transition-colors"
              >
                <PlusCircle className="h-3 w-3" /> ADD
              </button>
            </div>

            {/* Add Custom Category Collapsible Form */}
            {showCustomCatForm && (
              <form
                onSubmit={handleAddCustomCategory}
                className="reveal-panel mb-4 p-3 bg-white/2 rounded-xl border border-white/5 space-y-3"
              >
                <div>
                  <label className="block text-[10px] font-mono text-gray-400 mb-1 uppercase">Category Name</label>
                  <input
                    type="text"
                    required
                    value={customCatName}
                    onChange={(e) => setCustomCatName(e.target.value)}
                    placeholder="E.g. Creative, Health..."
                    className="smooth-field w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-gray-400 mb-1 uppercase">Theme Color</label>
                  <div className="flex gap-2">
                    {['#9ca3af', '#71717a', '#e5e7eb', '#4b5563', '#f3f4f6', '#3f3f46'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          playSynthesizedSound('click')
                          setCustomCatColor(color)
                        }}
                        className={`interactive-control h-5 w-5 rounded-full border transition-transform ${
                          customCatColor === color ? 'scale-125 border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playSynthesizedSound('click')
                      setShowCustomCatForm(false)
                    }}
                    className="interactive-control px-2 py-1 rounded text-[10px] font-mono text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="interactive-control px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-mono font-semibold"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* List of Categories with Counts */}
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  playSynthesizedSound('click')
                  setSelectedCategoryFilter('all')
                }}
                className={`interactive-control w-full text-left px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-zinc-800/30 text-zinc-300 border border-zinc-700/50'
                    : 'bg-transparent text-gray-400 hover:bg-white/2 hover:text-gray-300 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-zinc-400" />
                  <span>All Categories</span>
                </div>
                <span className="text-xs font-mono text-gray-500">{tasks.filter((t) => !t.completed).length}</span>
              </button>

              {categories.map((cat) => {
                const isRenaming = renamingCategoryId === cat.id
                if (isRenaming) {
                  return (
                    <form
                      key={cat.id}
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleRenameCategory(cat.id, renamingName)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="reveal-panel w-full text-left px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700/50 flex items-center gap-2"
                    >
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <input
                        type="text"
                        value={renamingName}
                        onChange={(e) => setRenamingName(e.target.value)}
                        onBlur={() => handleRenameCategory(cat.id, renamingName)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setRenamingCategoryId(null)
                        }}
                        autoFocus
                        className="smooth-field bg-transparent text-sm text-white focus:outline-none w-full p-0 font-medium border-none outline-none leading-none"
                      />
                    </form>
                  )
                }

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      playSynthesizedSound('click')
                      setSelectedCategoryFilter(cat.id)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      playSynthesizedSound('click')
                      setContextMenu({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        categoryId: cat.id
                      })
                    }}
                    className={`interactive-control w-full text-left px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                      selectedCategoryFilter === cat.id
                        ? 'text-white border'
                        : 'bg-transparent text-gray-400 hover:bg-white/2 hover:text-gray-300 border border-transparent'
                    } ${cat.disabled ? 'opacity-40' : ''}`}
                    style={{
                      backgroundColor: selectedCategoryFilter === cat.id ? `${cat.color}20` : undefined,
                      borderColor: selectedCategoryFilter === cat.id ? `${cat.color}50` : undefined,
                      boxShadow: selectedCategoryFilter === cat.id ? `0 0 10px ${cat.color}15` : undefined
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className={cat.disabled ? 'line-through decoration-zinc-500' : ''}>{cat.name}</span>
                      {cat.disabled && <span className="text-[9px] text-zinc-500 font-mono font-normal tracking-wide uppercase ml-1.5">(Disabled)</span>}
                    </div>
                    <span className="text-xs font-mono text-gray-500">{categoryCounts[cat.id] || 0}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* FLICKERING GRID SETTINGS & INTERACTION PANEL */}
          <div id="background-grid-card" className="glass-card motion-card rounded-2xl p-6">
            <button
              onClick={() => {
                playSynthesizedSound('click')
                setShowSettings(!showSettings)
              }}
              className="interactive-control w-full flex items-center justify-between text-white font-semibold text-base font-heading focus:outline-none"
            >
              <span className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-zinc-400" />
                Background Grid Matrix
              </span>
              {showSettings ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {showSettings && (
              <div className="reveal-panel mt-4 space-y-4 pt-3 border-t border-white/5 font-mono text-xs text-gray-400">
                {/* Grid Color Picker */}
                <div>
                  <label className="block mb-1.5">GRID SPECTRUM</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { name: 'Silver', val: 'rgb(209, 213, 219)' },
                      { name: 'Slate', val: 'rgb(148, 163, 184)' },
                      { name: 'Charcoal', val: 'rgb(75, 85, 99)' },
                      { name: 'White', val: 'rgb(255, 255, 255)' },
                      { name: 'Dark', val: 'rgb(31, 41, 55)' }
                    ].map((col) => (
                      <button
                        key={col.val}
                        onClick={() => {
                          playSynthesizedSound('click')
                          setGridColor(col.val)
                        }}
                        className={`interactive-control py-1 rounded text-[10px] font-semibold border text-center transition-all ${
                          gridColor === col.val
                            ? 'bg-white/10 border-white text-white'
                            : 'bg-black/30 border-white/5 hover:border-white/20'
                        }`}
                      >
                        {col.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity Slider */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span>GLOW OPACITY</span>
                    <span className="text-white font-semibold">{gridMaxOpacity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.6"
                    step="0.01"
                    value={gridMaxOpacity}
                    onChange={(e) => setGridMaxOpacity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                  />
                </div>

                {/* Gap Slider */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span>GAP SIZE</span>
                    <span className="text-white font-semibold">{gridGap}px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="16"
                    step="1"
                    value={gridGap}
                    onChange={(e) => setGridGap(parseInt(e.target.value))}
                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                  />
                </div>

                {/* Square Size */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span>SQUARE SIZE</span>
                    <span className="text-white font-semibold">{gridSquareSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={gridSquareSize}
                    onChange={(e) => setGridSquareSize(parseInt(e.target.value))}
                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                  />
                </div>

                {/* Flicker Chance */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span>FLICKER SPEED</span>
                    <span className="text-white font-semibold">{(gridFlickerChance * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={gridFlickerChance}
                    onChange={(e) => setGridFlickerChance(parseFloat(e.target.value))}
                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* MAIN TASKS BOARD (8 columns) */}
        <section className="lg:col-span-8 flex flex-col gap-6">

          {/* VIEW TOGGLE TABS */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  playSynthesizedSound('click')
                  setViewMode('list')
                }}
                className={`px-4 py-2 text-xs font-bold font-mono tracking-wider uppercase rounded-xl transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Feed List
              </button>
              <button
                type="button"
                onClick={() => {
                  playSynthesizedSound('click')
                  setViewMode('kanban')
                }}
                className={`px-4 py-2 text-xs font-bold font-mono tracking-wider uppercase rounded-xl transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-white text-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Kanban Board
              </button>
              <button
                type="button"
                onClick={() => {
                  playSynthesizedSound('click')
                  setViewMode('analytics')
                }}
                className={`px-4 py-2 text-xs font-bold font-mono tracking-wider uppercase rounded-xl transition-all ${
                  viewMode === 'analytics'
                    ? 'bg-white text-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Flow Analytics
              </button>
            </div>
          </div>

          {viewMode === 'list' && (
            <>
              {/* DYNAMIC TASK CREATION PANEL */}
          <div className="glass-card motion-card rounded-2xl p-6 relative overflow-hidden">
            <form onSubmit={handleAddTask} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Task title (e.g. Design app component...)"
                  value={newTitle}
                  onFocus={() => setIsFormExpanded(true)}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="smooth-field w-full bg-transparent border-b border-white/10 text-white font-medium text-lg py-2 focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-gray-500"
                />
              </div>

              {/* Expands on focus to reveal optional detailed settings */}
              {isFormExpanded && (
                <div className="reveal-panel space-y-4 pt-2">
                  <div>
                    <textarea
                      placeholder="Add task description..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={2}
                      className="smooth-field w-full bg-white/2 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-gray-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Priority Selector */}
                    <div>
                      <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase">Priority</label>
                      <div className="flex gap-1.5">
                        {(['low', 'medium', 'high'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              playSynthesizedSound('click')
                              setNewPriority(p)
                            }}
                            className={`interactive-control flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize border font-mono transition-all ${
                              newPriority === p
                                ? p === 'high'
                                  ? 'bg-zinc-300/10 border-zinc-400 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                                  : p === 'medium'
                                  ? 'bg-zinc-600/10 border-zinc-600/60 text-zinc-300'
                                  : 'bg-zinc-800/10 border-zinc-800 text-zinc-400'
                                : 'bg-white/2 border-white/5 text-gray-400 hover:border-white/10'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category Selector */}
                    <div>
                      <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase">Category</label>
                      <select
                        value={newCategory}
                        onChange={(e) => {
                          playSynthesizedSound('click')
                          setNewCategory(e.target.value)
                        }}
                        className="smooth-field w-full bg-white/2 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                      >
                        {categories.filter(c => !c.disabled).map((cat) => (
                          <option key={cat.id} value={cat.id} className="bg-zinc-950 text-white">
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Due Date Selector */}
                    <div>
                      <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase">Due Date</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={newDueDate}
                          onChange={(e) => setNewDueDate(e.target.value)}
                          className="smooth-field w-full bg-white/2 border border-white/5 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono min-h-[30px]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        playSynthesizedSound('click')
                        setIsFormExpanded(false)
                      }}
                      className="interactive-control px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                    >
                      Collapse
                    </button>
                    <button
                      type="submit"
                      className="interactive-control flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-zinc-700 to-zinc-500 text-white border border-zinc-600 shadow-[0_0_15px_rgba(255,255,255,0.04)] hover:shadow-[0_0_25px_rgba(255,255,255,0.08)] transition-all font-heading"
                    >
                      <Plus className="h-4 w-4" /> ENGAGE TASK
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* SEARCH, SORT AND FILTER CONTROL BAR */}
          <div className="glass-card motion-card rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search database..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="smooth-field w-full bg-black/30 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-gray-500"
              />
            </div>

            {/* Filters Group */}
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
              {/* Status Tab buttons */}
              <div className="flex border border-white/5 bg-black/20 rounded-xl p-0.5 font-mono text-xs">
                {(['all', 'active', 'completed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      playSynthesizedSound('click')
                      setStatusFilter(status)
                    }}
                    className={`interactive-control px-3 py-1.5 rounded-lg capitalize transition-colors font-medium ${
                      statusFilter === status
                        ? 'bg-zinc-800 text-zinc-200 border border-zinc-700/50 font-semibold'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Priority Dropdown Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => {
                  playSynthesizedSound('click')
                  setPriorityFilter(e.target.value)
                }}
                className="smooth-field bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="all" className="bg-[#121020]">All Priorities</option>
                <option value="high" className="bg-[#121020]">High Priority</option>
                <option value="medium" className="bg-[#121020]">Medium Priority</option>
                <option value="low" className="bg-[#121020]">Low Priority</option>
              </select>

              {/* Sorting Filter */}
              <select
                value={sortBy}
                onChange={(e) => {
                  playSynthesizedSound('click')
                  setSortBy(e.target.value as SortBy)
                }}
                className="smooth-field bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="createdAt" className="bg-[#121020]">Date Created</option>
                <option value="dueDate" className="bg-[#121020]">Due Date</option>
                <option value="priority" className="bg-[#121020]">Priority Level</option>
              </select>
            </div>
          </div>

          {/* FOCUS INTELLIGENCE */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="glass-card motion-card rounded-2xl p-5 xl:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="flex items-center gap-2 text-base font-semibold text-white font-heading">
                    <Brain className="h-4 w-4 text-zinc-400" />
                    Focus Intelligence
                  </h4>
                  <p className="mt-1 text-xs text-zinc-500">Pressure score: {intelligence.pressure}</p>
                </div>
                <span className={`rounded-xl border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                  intelligence.grade === 'Critical'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    : intelligence.grade === 'Elevated'
                      ? 'border-zinc-400/30 bg-zinc-400/10 text-zinc-200'
                      : 'border-white/10 bg-white/5 text-zinc-300'
                }`}>
                  {intelligence.grade}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-[10px] uppercase">
                <div className="stat-tile rounded-xl border border-white/5 p-3 text-center">
                  <span className="block text-xl font-bold text-white font-heading">{intelligence.dueToday}</span>
                  <span className="text-zinc-500">Today</span>
                </div>
                <div className="stat-tile rounded-xl border border-white/5 p-3 text-center">
                  <span className="block text-xl font-bold text-white font-heading">{intelligence.dueThisWeek}</span>
                  <span className="text-zinc-500">7 Days</span>
                </div>
                <div className="stat-tile rounded-xl border border-white/5 p-3 text-center">
                  <span className="block text-xl font-bold text-white font-heading">{intelligence.blockedBySubtasks}</span>
                  <span className="text-zinc-500">Stalled</span>
                </div>
              </div>
            </div>

            <div className="glass-card motion-card rounded-2xl p-5 xl:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-base font-semibold text-white font-heading">
                  <Target className="h-4 w-4 text-zinc-400" />
                  Recommended Next
                </h4>
                <span className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">Auto ranked</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {focusQueue.length === 0 ? (
                  <div className="md:col-span-3 rounded-xl border border-white/5 bg-white/2 p-4 text-sm text-zinc-500">
                    No active tasks need attention.
                  </div>
                ) : (
                  focusQueue.map((task, index) => {
                    const taskCat = categories.find((cat) => cat.id === task.category)
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          playSynthesizedSound('click')
                          setExpandedTaskId(task.id)
                        }}
                        className="interactive-control rounded-xl border border-white/5 bg-white/2 p-4 text-left hover:border-white/15"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="rounded-lg bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-300">#{index + 1}</span>
                          <span className="text-[10px] uppercase text-zinc-500">{task.priority}</span>
                        </div>
                        <h5 className="line-clamp-2 text-sm font-semibold text-white">{task.title}</h5>
                        <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: taskCat?.color || '#9ca3af' }} />
                            {taskCat?.name || task.category}
                          </span>
                          <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'No due date'}</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* ACTIVE CATEGORY BANNER */}
          {selectedCategoryFilter !== 'all' && activeCategory && (
            <div
              className="motion-pop px-4 py-2 rounded-xl flex items-center justify-between text-xs"
              style={{
                backgroundColor: `${activeCategory.color}15`,
                border: `1px solid ${activeCategory.color}35`
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white font-mono uppercase tracking-wider">Filtered Category:</span>
                <span className="px-2 py-0.5 rounded text-white font-bold" style={{ backgroundColor: activeCategory.color }}>
                  {activeCategory.name}
                </span>
              </div>
              <button
                onClick={() => {
                  playSynthesizedSound('click')
                  setSelectedCategoryFilter('all')
                }}
                className="icon-control text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {dueDateFilter && (
            <div className="motion-pop px-4 py-2 rounded-xl flex items-center justify-between text-xs border border-white/10 bg-white/5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white font-mono uppercase tracking-wider">Calendar Date:</span>
                <span className="px-2 py-0.5 rounded bg-zinc-200 text-zinc-950 font-bold">
                  {new Date(dueDateFilter).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => {
                  playSynthesizedSound('click')
                  setDueDateFilter(null)
                }}
                className="icon-control text-gray-400 hover:text-white transition-colors"
                aria-label="Clear calendar date filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* --- TASKS LIST CHECKLIST FEED --- */}
          <div className="space-y-4 min-h-[300px]">
            {filteredTasks.length === 0 ? (
              <div className="glass-card motion-pop rounded-2xl p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="h-8 w-8 text-zinc-500/40" />
                <div>
                  <p className="font-semibold text-gray-400">No active tasks in current sector.</p>
                  <p className="text-xs text-gray-600 mt-1">Configure filters or engage a new task using the console above.</p>
                </div>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isExpanded = expandedTaskId === task.id
                const isEditing = editingTaskId === task.id

                // Calculate subtask progress
                const hasSubtasks = task.subtasks.length > 0
                const completedSubs = task.subtasks.filter((s) => s.completed).length
                const subtasksProgress = hasSubtasks ? Math.round((completedSubs / task.subtasks.length) * 100) : 0

                // Get category color
                const taskCat = categories.find((c) => c.id === task.category)
                const categoryColor = taskCat ? taskCat.color : '#9ca3af'

                // Priority style helpers
                const priorityStyles = {
                  high: {
                    border: 'border-l-4 border-l-zinc-350',
                    badge: 'bg-zinc-800 text-zinc-200 border border-zinc-700/60',
                    dot: 'bg-zinc-300',
                    glow: 'shadow-[0_0_12px_rgba(255,255,255,0.06)]'
                  },
                  medium: {
                    border: 'border-l-4 border-l-zinc-500',
                    badge: 'bg-zinc-900 text-zinc-400 border border-zinc-800/60',
                    dot: 'bg-zinc-500',
                    glow: 'shadow-[0_0_12px_rgba(255,255,255,0.03)]'
                  },
                  low: {
                    border: 'border-l-4 border-l-zinc-700',
                    badge: 'bg-zinc-950 text-zinc-500 border border-zinc-900/60',
                    dot: 'bg-zinc-700',
                    glow: ''
                  }
                }
                const currentPriorityStyle = priorityStyles[task.priority]

                // Checking overdue
                const isOverdue = (() => {
                  if (task.completed || !task.dueDate) return false
                  const due = new Date(task.dueDate)
                  due.setHours(23, 59, 59, 999)
                  return due.getTime() < Date.now()
                })()

                return (
                  <div
                    key={task.id}
                    className={`glass-card motion-card task-card rounded-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      currentPriorityStyle.border
                    } ${currentPriorityStyle.glow} ${
                      task.completed ? 'opacity-65 hover:opacity-100' : ''
                    } ${isExpanded ? 'border-zinc-500/30' : 'hover:border-white/15'}`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => {
                        playSynthesizedSound('click')
                        setExpandedTaskId(isExpanded ? null : task.id)
                      }}
                      className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none transition-colors duration-300 hover:bg-white/[0.025]"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Checkbox circle with custom click sparks */}
                        <button
                          onClick={(e) => handleToggleComplete(e, task.id)}
                          className="icon-control flex-shrink-0 text-gray-500 hover:text-zinc-400 transition-colors focus:outline-none"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="h-6 w-6 text-zinc-200 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                          ) : (
                            <Circle className="h-6 w-6 text-gray-600 hover:text-zinc-400 transition-all hover:scale-105" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editTitle}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="smooth-field bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white w-full max-w-md focus:outline-none focus:border-zinc-500"
                            />
                          ) : (
                            <h3
                              className={`text-white font-medium text-base truncate leading-snug ${
                                task.completed ? 'line-through text-gray-500' : ''
                              }`}
                            >
                              {task.title}
                            </h3>
                          )}

                          {/* Subtags / details row */}
                          <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-gray-400 font-mono">
                            {/* Category tag */}
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: categoryColor }} />
                              {taskCat ? taskCat.name : task.category}
                            </span>
                            
                            <span aria-hidden="true" className="text-gray-600">/</span>

                            {/* Priority tag */}
                            <span className="capitalize">{task.priority} Priority</span>

                            {/* Subtasks Progress tag */}
                            {hasSubtasks && (
                              <>
                                <span aria-hidden="true" className="text-gray-600">/</span>
                                <span className="text-zinc-400">
                                  {completedSubs}/{task.subtasks.length} Subtasks ({subtasksProgress}%)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right-side details: Due Date & Action controls */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {/* Due Date Indicator */}
                        {task.dueDate && (
                          <div
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono border ${
                              isOverdue
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]'
                                : 'bg-white/2 text-gray-400 border-white/5'
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          </div>
                        )}

                        {/* XP Badge */}
                        <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 text-zinc-300 font-mono text-[10px]">
                          <Award className="h-3 w-3 text-zinc-450" />
                          <span>+{task.xpReward} XP</span>
                        </div>

                        {/* Expand Icon */}
                        {isExpanded ? (
                          <ChevronUp className="task-chevron h-4 w-4 text-gray-400 transition-transform duration-300" />
                        ) : (
                          <ChevronDown className="task-chevron h-4 w-4 text-gray-400 transition-transform duration-300" />
                        )}
                      </div>
                    </div>

                    {/* Detailed Expanded Area */}
                    {isExpanded && (
                      <div className="task-details px-5 pb-5 border-t border-white/5 bg-black/15 space-y-4">
                        {/* Task Editing Area */}
                        {isEditing ? (
                          <div className="reveal-panel space-y-4 pt-4">
                            <div>
                              <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase">Task Description</label>
                              <textarea
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                rows={2}
                                className="smooth-field w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 resize-none"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* Edit Priority */}
                              <div>
                                <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase">Priority</label>
                                <div className="flex gap-1">
                                  {(['low', 'medium', 'high'] as const).map((p) => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => {
                                        playSynthesizedSound('click')
                                        setEditPriority(p)
                                      }}
                                      className={`interactive-control flex-1 py-1 rounded text-xs font-semibold capitalize border font-mono ${
                                        editPriority === p
                                          ? p === 'high'
                                            ? 'bg-zinc-300/10 border-zinc-400 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                                            : p === 'medium'
                                            ? 'bg-zinc-600/10 border-zinc-600/60 text-zinc-300'
                                            : 'bg-zinc-800/10 border-zinc-800 text-zinc-400'
                                          : 'bg-black/20 border-white/5 text-gray-400 hover:border-white/10'
                                      }`}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Edit Category */}
                              <div>
                                <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase">Category</label>
                                <select
                                  value={editCategory}
                                  onChange={(e) => {
                                    playSynthesizedSound('click')
                                    setEditCategory(e.target.value)
                                  }}
                                  className="smooth-field w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                                >
                                  {categories.filter(c => !c.disabled || c.id === task.category).map((cat) => (
                                    <option key={cat.id} value={cat.id} className="bg-zinc-950 text-white">
                                      {cat.name} {cat.disabled ? '(disabled)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Edit Due Date */}
                              <div>
                                <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase">Due Date</label>
                                <input
                                  type="date"
                                  value={editDueDate}
                                  onChange={(e) => setEditDueDate(e.target.value)}
                                  className="smooth-field w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                onClick={() => {
                                  playSynthesizedSound('click')
                                  setEditingTaskId(null)
                                }}
                                className="interactive-control px-3 py-1.5 border border-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-mono"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(task.id)}
                                className="interactive-control px-3.5 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs font-mono font-semibold"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Standard View Mode inside expansion
                          <div className="space-y-4 pt-4">
                            {/* Description text */}
                            {task.description ? (
                              <p className="text-sm text-gray-300 leading-relaxed font-sans pr-4">{task.description}</p>
                            ) : (
                              <p className="text-xs text-gray-600 italic">No description provided for this core directive.</p>
                            )}

                            {/* Subtasks checklist section */}
                            <div className="space-y-3.5">
                              <div className="flex justify-between items-center">
                                <h4 className="text-xs font-mono text-gray-400 uppercase tracking-wide">
                                  Subtask Matrix
                                </h4>
                                {hasSubtasks && (
                                  <span className="text-[10px] font-mono text-zinc-400">
                                    {subtasksProgress}% COMPLETE
                                  </span>
                                )}
                              </div>

                              {/* Subtask Progress bar */}
                              {hasSubtasks && (
                                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                  <div
                                    className="h-full bg-zinc-400 rounded-full transition-all duration-300"
                                    style={{ width: `${subtasksProgress}%` }}
                                  />
                                </div>
                              )}

                                {/* Subtask list */}
                                <div className="space-y-2">
                                  {task.subtasks.map((sub) => (
                                    <div
                                      key={sub.id}
                                      className="interactive-control flex items-center justify-between p-2.5 bg-white/2 border border-white/5 rounded-xl text-xs hover:border-white/10 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => handleToggleSubtask(task.id, sub.id)}
                                          className="icon-control text-gray-500 hover:text-zinc-400 transition-colors focus:outline-none"
                                        >
                                          {sub.completed ? (
                                            <CheckCircle2 className="h-4.5 w-4.5 text-zinc-300 fill-zinc-300/10" />
                                          ) : (
                                            <Circle className="h-4.5 w-4.5 text-gray-600" />
                                          )}
                                        </button>
                                        <span className={sub.completed ? 'line-through text-gray-500' : 'text-gray-300'}>
                                          {sub.title}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteSubtask(task.id, sub.id)}
                                        className="icon-control text-gray-500 hover:text-zinc-400 transition-colors"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                {/* Add Subtask Input Form */}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Formulate subtask..."
                                    value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                    className="smooth-field flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 placeholder:text-gray-600"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddSubtask(task.id)}
                                    className="interactive-control px-3.5 py-1.5 bg-zinc-900 text-zinc-300 border border-zinc-700/40 hover:bg-zinc-800 rounded-lg text-xs font-mono font-semibold transition-colors"
                                  >
                                    ADD
                                  </button>
                                </div>

                              </div>

                              {/* Core Action row */}
                              <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs font-mono">
                                <span className="text-gray-500">Engaged: {new Date(task.createdAt).toLocaleString()}</span>
                                
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      playSynthesizedSound('click')
                                      setFocusTaskId(task.id)
                                      setShowFocusMode(true)
                                    }}
                                    className="interactive-control flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white text-zinc-950 font-semibold transition-colors"
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Sync Focus</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      playSynthesizedSound('click')
                                      startEditing(task)
                                    }}
                                    className="interactive-control flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 hover:bg-white/5 hover:text-white transition-colors"
                                  >
                                    <Undo className="h-3.5 w-3.5 text-zinc-400" />
                                    <span>Edit Data</span>
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteTask(e, task.id)}
                                    className="interactive-control flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-950/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Purge Task</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            </>
          )}

          {viewMode === 'kanban' && (
            <KanbanBoard
              tasks={filteredTasks}
              categories={categories}
              onComplete={(id) => handleToggleComplete(null, id)}
              onDelete={(id) => handleDeleteTask(null, id)}
              onEdit={(id) => {
                const task = tasks.find((t) => t.id === id)
                if (task) startEditing(task)
              }}
              onExpand={(id) => setExpandedTaskId(expandedTaskId === id ? null : id)}
              onTaskDrop={handleTaskColumnChange}
            />
          )}

          {viewMode === 'analytics' && (
            <AnalyticsPanel
              tasks={tasks}
              categories={categories}
            />
          )}
          </section>
        </main>

        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          tasks={tasks}
          categories={categories}
          onSelectTask={(id) => {
            playSynthesizedSound('click')
            setExpandedTaskId(id)
            setViewMode('list')
          }}
          onAddTask={handleQuickAddTask}
          onToggleSettings={() => {
            playSynthesizedSound('click')
            setShowSettings((prev) => !prev)
          }}
          onClearCompleted={handleClearCompleted}
          onSelectCategoryFilter={(id) => {
            playSynthesizedSound('click')
            setSelectedCategoryFilter(id)
          }}
          onSelectViewMode={(mode) => {
            playSynthesizedSound('click')
            setViewMode(mode)
          }}
          onLogout={handleSignOut}
        />

        <FocusSpace
          isOpen={showFocusMode}
          onClose={() => {
            setShowFocusMode(false)
            setFocusTaskId(null)
          }}
          task={tasks.find((t) => t.id === focusTaskId) || null}
          onRewardXP={(amount) => {
            handleXPGain(amount)
            updateStreak()
          }}
        />

        {/* --- LEVEL UP SUCCESS OVERLAY MODAL --- */}
        {showLevelUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md px-4 animate-fade-in">
            <div className="relative glass-card motion-pop max-w-md w-full rounded-3xl p-8 border-zinc-500/40 shadow-[0_0_50px_rgba(255,255,255,0.15)] text-center space-y-6">
              
              {/* Sparkles icon background glow */}
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-zinc-700 to-zinc-400 shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                <Trophy className="h-10 w-10 text-white animate-bounce" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-extrabold font-heading text-white m-0 tracking-tight">LEVEL ACQUIRED!</h2>
                <p className="text-sm font-mono text-zinc-400 uppercase tracking-widest">You have ascended in focus</p>
              </div>

              <div className="py-4 px-6 bg-white/3 border border-white/5 rounded-2xl">
                <span className="block text-xs font-mono text-gray-400">NEW DIRECTIVE TITLE</span>
                <span className="block text-2xl font-bold font-heading text-zinc-200 mt-1">{unlockedTitle}</span>
                <span className="block text-xs font-mono text-zinc-400 font-bold mt-2">LEVEL {profile.level} REACHED</span>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Your workflow throughput has expanded. Continue executing directives to acquire further standing in the Aether spectrum.
              </p>

              <button
                onClick={() => {
                  playSynthesizedSound('click')
                  setShowLevelUp(false)
                }}
                className="interactive-control w-full py-3.5 bg-gradient-to-r from-zinc-700 to-zinc-500 hover:from-zinc-600 hover:to-zinc-500 border border-zinc-700 text-white rounded-2xl font-semibold shadow-lg transition-all"
              >
                ACKNOWLEDGE MATRIX
              </button>
            </div>
          </div>
        )}

        {/* --- CUSTOM RIGHT-CLICK CATEGORY CONTEXT MENU --- */}
        {contextMenu && contextMenu.visible && (
          <div
            className="fixed z-50 bg-zinc-950/90 border border-white/10 rounded-xl py-1.5 min-w-[140px] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.8),_0_0_15px_rgba(255,255,255,0.03)] backdrop-blur-md motion-pop"
            style={{
              left: (() => {
                let left = contextMenu.x
                if (left + 160 > window.innerWidth) {
                  left = window.innerWidth - 170
                }
                return Math.max(10, left)
              })(),
              top: (() => {
                let top = contextMenu.y
                if (top + 120 > window.innerHeight) {
                  top = window.innerHeight - 130
                }
                return Math.max(10, top)
              })()
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                playSynthesizedSound('click')
                setRenamingCategoryId(contextMenu.categoryId)
                const cat = categories.find((c) => c.id === contextMenu.categoryId)
                setRenamingName(cat ? cat.name : '')
                setContextMenu(null)
              }}
              className="interactive-control w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors font-mono flex items-center gap-2"
            >
              Rename
            </button>
            {contextMenu.categoryId !== 'inbox' && (
              <>
                <button
                  onClick={() => {
                    handleToggleDisableCategory(contextMenu.categoryId)
                    setContextMenu(null)
                  }}
                  className="interactive-control w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors font-mono flex items-center gap-2"
                >
                  {categories.find((c) => c.id === contextMenu.categoryId)?.disabled ? 'Enable' : 'Disable'}
                </button>
                <div className="border-t border-white/5 my-1" />
                <button
                  onClick={() => {
                    handleDeleteCategory(contextMenu.categoryId)
                    setContextMenu(null)
                  }}
                  className="interactive-control w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition-colors font-mono flex items-center gap-2"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }
