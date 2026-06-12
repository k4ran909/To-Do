import React, { useState, useEffect, useMemo } from 'react'
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
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
  Undo
} from 'lucide-react'
import { FlickeringGrid } from '@/components/ui/FlickeringGrid'
import type { Task, SubTask, UserProfile } from './types'

// Category type for customization
interface Category {
  id: string
  name: string
  color: string // Hex or color name
  glowColor: string
  disabled?: boolean
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'inbox', name: 'Inbox', color: '#9ca3af', glowColor: 'rgba(156, 163, 175, 0.2)' },
  { id: 'work', name: 'Work', color: '#71717a', glowColor: 'rgba(113, 113, 122, 0.2)' },
  { id: 'personal', name: 'Personal', color: '#e5e7eb', glowColor: 'rgba(229, 231, 235, 0.2)' },
  { id: 'fitness', name: 'Fitness', color: '#4b5563', glowColor: 'rgba(75, 85, 99, 0.2)' },
  { id: 'ideas', name: 'Ideas', color: '#f3f4f6', glowColor: 'rgba(243, 244, 246, 0.2)' }
]

// Audio synthesizer for premium UX sound feedback
const playSynthesizedSound = (type: 'complete' | 'click' | 'levelUp' | 'delete') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
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
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'createdAt'>('createdAt')

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

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    localStorage.setItem('aether_tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('aether_categories', JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    localStorage.setItem('aether_profile', JSON.stringify(profile))
  }, [profile])

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

  const handleToggleComplete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const task = tasks.find((t) => t.id === id)
    if (!task) return

    const newCompleted = !task.completed
    playSynthesizedSound(newCompleted ? 'complete' : 'click')

    if (newCompleted) {
      // Complete: spawn particle explosion at the mouse cursor coordinate
      emitSparks(e.clientX, e.clientY, '#ffffff')
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

  const handleDeleteTask = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    playSynthesizedSound('delete')
    setTasks((prev) => prev.filter((t) => t.id !== id))
    if (expandedTaskId === id) setExpandedTaskId(null)
    if (editingTaskId === id) setEditingTaskId(null)
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
    const today = new Date().toDateString()
    const todayTasks = tasks.filter((t) => new Date(t.createdAt).toDateString() === today)
    const todayCompleted = todayTasks.filter((t) => t.completed)
    const completionRate = todayTasks.length > 0 ? Math.round((todayCompleted.length / todayTasks.length) * 100) : 0

    const highPriorityActive = tasks.filter((t) => !t.completed && t.priority === 'high').length
    const overdueTasks = tasks.filter((t) => {
      if (t.completed || !t.dueDate) return false
      const due = new Date(t.dueDate)
      due.setHours(23, 59, 59, 999) // End of day
      return due.getTime() < Date.now()
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
  }, [tasks])

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

        return matchesSearch && matchesStatus && matchesPriority && matchesCategory
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
  }, [tasks, searchQuery, statusFilter, priorityFilter, selectedCategoryFilter, sortBy])

  // Render SVG circular progress bar logic
  const circleRadius = 35
  const circleCircumference = 2 * Math.PI * circleRadius
  const circleDashOffset = circleCircumference - (stats.completionRate / 100) * circleCircumference

  return (
    <div className="relative min-h-screen bg-[#000000] text-gray-200 overflow-x-hidden font-sans pb-16 selection:bg-zinc-500/30 selection:text-zinc-300">
      {/* Spacer to prevent page content layout shift/jump due to fixed header positioning */}
      <div className="h-[136px] md:h-[73px]" />
      {/* Canvas Flickering Grid Background */}
      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none opacity-40">
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
          className="fixed pointer-events-none rounded-full z-50 transition-transform"
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
            <Flame className={`text-zinc-355 fill-zinc-400/35 animate-bounce transition-all duration-500 ${isScrolled ? 'h-4.5 w-4.5' : 'h-5 w-5'}`} />
            <span className={`font-bold font-heading transition-all duration-500 ${isScrolled ? 'text-base' : 'text-lg'}`}>{profile.streak}</span>
            <span className={`text-[10px] text-zinc-400/70 font-mono transition-all duration-500 ${
              isScrolled ? 'hidden md:inline' : 'inline'
            }`}>
              DAY STREAK
            </span>
          </div>
        </div>
      </header>

      {/* --- DASHBOARD GRID --- */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR: NAVIGATION & METRICS (4 columns) */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          
          {/* USER PROFILE & LEVEL SYSTEM */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-zinc-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-4">
              {/* Level Circle Display */}
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/3 border-2 border-zinc-500/50 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
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
              <div className="bg-white/2 rounded-xl p-3 border border-white/5 text-center">
                <span className="block text-xs text-gray-400 uppercase">Completed</span>
                <span className="text-xl font-bold text-white font-heading">{profile.totalCompletedTasks}</span>
              </div>
              <div className="bg-white/2 rounded-xl p-3 border border-white/5 text-center">
                <span className="block text-xs text-gray-400 uppercase">Active</span>
                <span className="text-xl font-bold text-zinc-300 font-heading">{stats.totalActive}</span>
              </div>
            </div>
          </div>

          {/* DAILY PRODUCTIVITY METRIC */}
          <div className="glass-card rounded-2xl p-6 flex items-center justify-between gap-4">
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

          {/* CATEGORIES SELECTION & DYNAMIC MANAGER */}
          <div id="category-filters-card" className="glass-card rounded-2xl p-6">
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
                className="text-xs text-zinc-400 hover:text-zinc-300 font-mono flex items-center gap-1 bg-zinc-800/10 hover:bg-zinc-800/20 px-2 py-1 rounded transition-colors"
              >
                <PlusCircle className="h-3 w-3" /> ADD
              </button>
            </div>

            {/* Add Custom Category Collapsible Form */}
            {showCustomCatForm && (
              <form
                onSubmit={handleAddCustomCategory}
                className="mb-4 p-3 bg-white/2 rounded-xl border border-white/5 space-y-3 animate-slide-up"
              >
                <div>
                  <label className="block text-[10px] font-mono text-gray-400 mb-1 uppercase">Category Name</label>
                  <input
                    type="text"
                    required
                    value={customCatName}
                    onChange={(e) => setCustomCatName(e.target.value)}
                    placeholder="E.g. Creative, Health..."
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
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
                        className={`h-5 w-5 rounded-full border transition-transform ${
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
                    className="px-2 py-1 rounded text-[10px] font-mono text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-mono font-semibold"
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
                className={`w-full text-left px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
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
                      className="w-full text-left px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700/50 flex items-center gap-2"
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
                        className="bg-transparent text-sm text-white focus:outline-none w-full p-0 font-medium border-none outline-none leading-none"
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
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
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
          <div id="background-grid-card" className="glass-card rounded-2xl p-6">
            <button
              onClick={() => {
                playSynthesizedSound('click')
                setShowSettings(!showSettings)
              }}
              className="w-full flex items-center justify-between text-white font-semibold text-base font-heading focus:outline-none"
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
              <div className="mt-4 space-y-4 pt-3 border-t border-white/5 font-mono text-xs text-gray-400 animate-slide-up">
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
                        className={`py-1 rounded text-[10px] font-semibold border text-center transition-all ${
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

          {/* DYNAMIC TASK CREATION PANEL */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
            <form onSubmit={handleAddTask} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Task title (e.g. Design app component...)"
                  value={newTitle}
                  onFocus={() => setIsFormExpanded(true)}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 text-white font-medium text-lg py-2 focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-gray-500"
                />
              </div>

              {/* Expands on focus to reveal optional detailed settings */}
              {isFormExpanded && (
                <div className="space-y-4 pt-2 animate-slide-up">
                  <div>
                    <textarea
                      placeholder="Add task description..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-white/2 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-gray-500 resize-none"
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
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize border font-mono transition-all ${
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
                        className="w-full bg-white/2 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
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
                          className="w-full bg-white/2 border border-white/5 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono min-h-[30px]"
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
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                    >
                      Collapse
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-zinc-700 to-zinc-500 text-white border border-zinc-650 shadow-[0_0_15px_rgba(255,255,255,0.04)] hover:shadow-[0_0_25px_rgba(255,255,255,0.08)] transition-all font-heading"
                    >
                      <Plus className="h-4 w-4" /> ENGAGE TASK
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* SEARCH, SORT AND FILTER CONTROL BAR */}
          <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search database..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/30 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-gray-500"
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
                    className={`px-3 py-1.5 rounded-lg capitalize transition-colors font-medium ${
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
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-zinc-500 font-mono"
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
                  setSortBy(e.target.value as any)
                }}
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="createdAt" className="bg-[#121020]">Date Created</option>
                <option value="dueDate" className="bg-[#121020]">Due Date</option>
                <option value="priority" className="bg-[#121020]">Priority Level</option>
              </select>
            </div>
          </div>

          {/* ACTIVE CATEGORY BANNER */}
          {selectedCategoryFilter !== 'all' && activeCategory && (
            <div
              className="px-4 py-2 rounded-xl flex items-center justify-between text-xs animate-slide-up"
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
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* --- TASKS LIST CHECKLIST FEED --- */}
          <div className="space-y-4 min-h-[300px]">
            {filteredTasks.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
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
                    border: 'border-l-4 border-l-zinc-550',
                    badge: 'bg-zinc-900 text-zinc-400 border border-zinc-800/60',
                    dot: 'bg-zinc-500',
                    glow: 'shadow-[0_0_12px_rgba(255,255,255,0.03)]'
                  },
                  low: {
                    border: 'border-l-4 border-l-zinc-750',
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
                    className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 animate-slide-up ${
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
                      className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Checkbox circle with custom click sparks */}
                        <button
                          onClick={(e) => handleToggleComplete(e, task.id)}
                          className="flex-shrink-0 text-gray-500 hover:text-zinc-400 transition-colors focus:outline-none"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="h-6 w-6 text-zinc-200 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                          ) : (
                            <Circle className="h-6 w-6 text-gray-650 hover:border-zinc-500 transition-all hover:scale-105" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editTitle}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white w-full max-w-md focus:outline-none focus:border-zinc-500"
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
                            
                            <span>•</span>

                            {/* Priority tag */}
                            <span className="capitalize">{task.priority} Priority</span>

                            {/* Subtasks Progress tag */}
                            {hasSubtasks && (
                              <>
                                <span>•</span>
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
                                ? 'bg-rose-500/10 text-rose-450 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]'
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
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Detailed Expanded Area */}
                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-white/5 bg-black/15 space-y-4">
                        {/* Task Editing Area */}
                        {isEditing ? (
                          <div className="space-y-4 pt-4 animate-slide-up">
                            <div>
                              <label className="block text-[10px] font-mono text-gray-400 mb-1.5 uppercase">Task Description</label>
                              <textarea
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                rows={2}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 resize-none"
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
                                      className={`flex-1 py-1 rounded text-xs font-semibold capitalize border font-mono ${
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
                                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
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
                                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                onClick={() => {
                                  playSynthesizedSound('click')
                                  setEditingTaskId(null)
                                }}
                                className="px-3 py-1.5 border border-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-mono"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(task.id)}
                                className="px-3.5 py-1.5 bg-zinc-700 hover:bg-zinc-650 text-white rounded-lg text-xs font-mono font-semibold"
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
                                      className="flex items-center justify-between p-2.5 bg-white/2 border border-white/5 rounded-xl text-xs hover:border-white/10 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => handleToggleSubtask(task.id, sub.id)}
                                          className="text-gray-500 hover:text-zinc-400 transition-colors focus:outline-none"
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
                                        className="text-gray-500 hover:text-zinc-400 transition-colors"
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
                                    className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 placeholder:text-gray-600"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddSubtask(task.id)}
                                    className="px-3.5 py-1.5 bg-zinc-900 text-zinc-300 border border-zinc-700/40 hover:bg-zinc-800 rounded-lg text-xs font-mono font-semibold transition-colors"
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
                                      startEditing(task)
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 hover:bg-white/5 hover:text-white transition-colors"
                                  >
                                    <Undo className="h-3.5 w-3.5 text-zinc-400" />
                                    <span>Edit Data</span>
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteTask(e, task.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-950/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
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
          </section>
        </main>

        {/* --- LEVEL UP SUCCESS OVERLAY MODAL --- */}
        {showLevelUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md px-4 animate-fade-in">
            <div className="relative glass-card max-w-md w-full rounded-3xl p-8 border-zinc-500/40 shadow-[0_0_50px_rgba(255,255,255,0.15)] text-center space-y-6 animate-slide-up">
              
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
                className="w-full py-3.5 bg-gradient-to-r from-zinc-700 to-zinc-500 hover:from-zinc-600 hover:to-zinc-500 border border-zinc-700 text-white rounded-2xl font-semibold shadow-lg transition-all"
              >
                ACKNOWLEDGE MATRIX
              </button>
            </div>
          </div>
        )}

        {/* --- CUSTOM RIGHT-CLICK CATEGORY CONTEXT MENU --- */}
        {contextMenu && contextMenu.visible && (
          <div
            className="fixed z-50 bg-zinc-950/90 border border-white/10 rounded-xl py-1.5 min-w-[140px] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.8),_0_0_15px_rgba(255,255,255,0.03)] backdrop-blur-md animate-slide-up"
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
              className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors font-mono flex items-center gap-2"
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
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors font-mono flex items-center gap-2"
                >
                  {categories.find((c) => c.id === contextMenu.categoryId)?.disabled ? 'Enable' : 'Disable'}
                </button>
                <div className="border-t border-white/5 my-1" />
                <button
                  onClick={() => {
                    handleDeleteCategory(contextMenu.categoryId)
                    setContextMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-455 hover:bg-rose-955/20 hover:text-rose-400 transition-colors font-mono flex items-center gap-2"
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
