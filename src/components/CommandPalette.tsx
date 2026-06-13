import React, { useState, useEffect, useRef } from 'react'
import { Search, Terminal, Plus, Trash2, LogOut, Sliders, LayoutGrid, BarChart3, Filter, X, ChevronRight } from 'lucide-react'
import type { Task, Category } from '../types'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  categories: Category[]
  onSelectTask: (taskId: string) => void
  onAddTask: (title: string) => void
  onToggleSettings: () => void
  onClearCompleted: () => void
  onSelectCategoryFilter: (categoryId: string) => void
  onSelectViewMode: (mode: 'list' | 'kanban' | 'analytics') => void
  onLogout: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  tasks,
  categories,
  onSelectTask,
  onAddTask,
  onToggleSettings,
  onClearCompleted,
  onSelectCategoryFilter,
  onSelectViewMode,
  onLogout
}) => {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount/open
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Define static commands
  const commands = [
    {
      id: 'cmd-list-view',
      title: 'Switch to Feed List View',
      category: 'Navigation',
      icon: <Terminal className="h-4 w-4 text-zinc-400" />,
      action: () => onSelectViewMode('list')
    },
    {
      id: 'cmd-kanban-view',
      title: 'Switch to Kanban Board View',
      category: 'Navigation',
      icon: <LayoutGrid className="h-4 w-4 text-zinc-400" />,
      action: () => onSelectViewMode('kanban')
    },
    {
      id: 'cmd-analytics-view',
      title: 'Switch to Flow Analytics View',
      category: 'Navigation',
      icon: <BarChart3 className="h-4 w-4 text-zinc-400" />,
      action: () => onSelectViewMode('analytics')
    },
    {
      id: 'cmd-add-task',
      title: 'Quick Create Task...',
      category: 'Actions',
      icon: <Plus className="h-4 w-4 text-zinc-400" />,
      action: () => {
        const title = prompt('Enter task title:')
        if (title && title.trim()) {
          onAddTask(title.trim())
        }
      }
    },
    {
      id: 'cmd-clear-completed',
      title: 'Purge Completed Tasks',
      category: 'Actions',
      icon: <Trash2 className="h-4 w-4 text-zinc-400" />,
      action: () => {
        if (confirm('Are you sure you want to delete all completed tasks?')) {
          onClearCompleted()
        }
      }
    },
    {
      id: 'cmd-toggle-settings',
      title: 'Toggle Background Matrix Settings',
      category: 'Preferences',
      icon: <Sliders className="h-4 w-4 text-zinc-400" />,
      action: () => onToggleSettings()
    },
    {
      id: 'cmd-logout',
      title: 'Disconnect Session (Logout)',
      category: 'System',
      icon: <LogOut className="h-4 w-4 text-rose-400" />,
      action: () => onLogout()
    }
  ]

  // Add category filters dynamically to commands list
  const categoryCommands = categories.map((cat) => ({
    id: `cmd-filter-${cat.id}`,
    title: `Filter by Category: ${cat.name}`,
    category: 'Filters',
    icon: <Filter className="h-4 w-4" style={{ color: cat.color }} />,
    action: () => onSelectCategoryFilter(cat.id)
  }))

  const allStaticCommands = [...commands, ...categoryCommands]

  // Filter tasks based on search
  const matchingTasks = tasks
    .filter((task) => task.title.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 5) // Show top 5 matching tasks
    .map((task) => ({
      id: `task-${task.id}`,
      title: `Go to: ${task.title}`,
      category: 'Tasks',
      icon: <ChevronRight className="h-4 w-4 text-zinc-500" />,
      action: () => onSelectTask(task.id)
    }))

  // Combine matching tasks and command items
  const filteredItems = search.trim()
    ? [...matchingTasks, ...allStaticCommands.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))]
    : allStaticCommands

  // Keyboard navigation listener
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action()
          onClose()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredItems, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-[15vh] transition-opacity duration-200 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-950/95 border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col motion-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/2">
          <Search className="h-5 w-5 text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search tasks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            className="w-full bg-transparent text-white placeholder-zinc-500 text-sm focus:outline-none py-1"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[350px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-600 font-mono">
              NO MATCHING COMMANDS FOUND
            </div>
          ) : (
            // Group by category helper or simple list
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action()
                    onClose()
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? 'bg-white text-zinc-950 font-semibold shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                      : 'text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex-shrink-0 ${isSelected ? 'text-zinc-950' : ''}`}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </div>
                  <span className={`text-[9px] font-bold font-mono tracking-wider uppercase px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-zinc-900 text-white' : 'bg-white/5 text-zinc-500 border border-white/5'
                  }`}>
                    {item.category}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Console Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/60 border-t border-white/5 text-[9px] font-mono text-zinc-500 select-none">
          <div className="flex items-center gap-3">
            <span>Use <kbd className="bg-white/5 px-1 py-0.5 rounded border border-white/10 text-zinc-400">↑↓</kbd> to navigate</span>
            <span><kbd className="bg-white/5 px-1 py-0.5 rounded border border-white/10 text-zinc-400">Enter</kbd> to execute</span>
          </div>
          <span><kbd className="bg-white/5 px-1 py-0.5 rounded border border-white/10 text-zinc-400">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  )
}
