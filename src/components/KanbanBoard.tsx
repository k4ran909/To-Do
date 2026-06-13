import React, { useState } from 'react'
import { CheckCircle2, Circle, Trash2, Calendar, Edit2, AlertCircle } from 'lucide-react'
import type { Task, Category } from '../types'

interface KanbanBoardProps {
  tasks: Task[]
  categories: Category[]
  onComplete: (taskId: string) => void
  onDelete: (taskId: string) => void
  onEdit: (taskId: string) => void
  onExpand: (taskId: string) => void
  onTaskDrop: (taskId: string, targetColumn: 'todo' | 'in_progress' | 'completed') => void
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  categories,
  onComplete,
  onDelete,
  onEdit,
  onExpand,
  onTaskDrop
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState<'todo' | 'in_progress' | 'completed' | null>(null)

  // Segregate tasks into columns
  const todoTasks = tasks.filter((t) => !t.completed && !t.inProgress)
  const inProgressTasks = tasks.filter((t) => !t.completed && t.inProgress)
  const completedTasks = tasks.filter((t) => t.completed)

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId)
    setActiveDragId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setActiveDragId(null)
    setDraggedOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, columnId: 'todo' | 'in_progress' | 'completed') => {
    e.preventDefault()
    if (draggedOverColumn !== columnId) {
      setDraggedOverColumn(columnId)
    }
  }

  const handleDrop = (e: React.DragEvent, targetColumn: 'todo' | 'in_progress' | 'completed') => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain') || activeDragId
    if (taskId) {
      onTaskDrop(taskId, targetColumn)
    }
    setDraggedOverColumn(null)
    setActiveDragId(null)
  }

  const renderTaskCard = (task: Task) => {
    const taskCat = categories.find((c) => c.id === task.category)
    const categoryColor = taskCat ? taskCat.color : '#9ca3af'
    const hasSubtasks = task.subtasks.length > 0
    const completedSubs = task.subtasks.filter((s) => s.completed).length
    const progress = hasSubtasks ? Math.round((completedSubs / task.subtasks.length) * 100) : 0

    const priorityStyles = {
      high: 'border-l-4 border-l-zinc-300 shadow-[0_0_12px_rgba(255,255,255,0.03)]',
      medium: 'border-l-4 border-l-zinc-500 shadow-[0_0_8px_rgba(255,255,255,0.01)]',
      low: 'border-l-4 border-l-zinc-700'
    }

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragEnd={handleDragEnd}
        className={`glass-card p-4 rounded-xl flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:bg-white/3 transition-all duration-200 border border-white/5 ${
          priorityStyles[task.priority]
        } ${activeDragId === task.id ? 'opacity-40 scale-[0.98]' : 'opacity-100'}`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onComplete(task.id)}
            className="group flex-shrink-0 mt-0.5"
            aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          >
            {task.completed ? (
              <CheckCircle2 className="h-4 w-4 text-zinc-350 fill-zinc-300/10 group-hover:scale-110 transition-transform" />
            ) : (
              <Circle className="h-4 w-4 text-zinc-500 hover:text-zinc-300 group-hover:scale-110 transition-transform" />
            )}
          </button>
          
          <span
            onClick={() => onExpand(task.id)}
            className={`flex-grow text-xs font-semibold select-none leading-snug cursor-pointer hover:text-white transition-colors ${
              task.completed ? 'text-zinc-500 line-through' : 'text-zinc-200'
            }`}
          >
            {task.title}
          </span>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onEdit(task.id)}
              className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Edit task"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-white/5 transition-colors"
              aria-label="Delete task"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Task Category Tag & Due Date */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
          <span
            className="px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono tracking-wider uppercase bg-white/2 border border-white/5"
            style={{ color: categoryColor, borderColor: `${categoryColor}15` }}
          >
            {taskCat?.name || task.category}
          </span>

          {task.dueDate && (
            <span className="flex items-center gap-1 font-mono text-zinc-400">
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Subtask Progress Bar */}
        {hasSubtasks && (
          <div className="mt-1 space-y-1">
            <div className="flex justify-between text-[9px] font-mono text-zinc-500">
              <span>CHECKLIST PROGRESS</span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden border border-white/2">
              <div
                className="h-full bg-zinc-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderColumn = (
    columnId: 'todo' | 'in_progress' | 'completed',
    title: string,
    columnTasks: Task[],
    borderGlowClass: string,
    headerDotColor: string
  ) => {
    const isOver = draggedOverColumn === columnId

    return (
      <div
        onDragOver={(e) => handleDragOver(e, columnId)}
        onDragLeave={() => setDraggedOverColumn(null)}
        onDrop={(e) => handleDrop(e, columnId)}
        className={`flex flex-col gap-4 p-5 rounded-2xl min-h-[550px] transition-all duration-300 border ${
          isOver
            ? `${borderGlowClass} bg-white/5 scale-[1.01]`
            : 'border-white/5 bg-zinc-950/30'
        }`}
      >
        {/* Column Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${headerDotColor} animate-pulse`} />
            <h4 className="text-white font-semibold text-sm font-heading tracking-wide">{title}</h4>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white/2 border border-white/5 text-[10px] font-mono text-zinc-400">
            {columnTasks.length}
          </span>
        </div>

        {/* Tasks Container */}
        <div className="flex-grow overflow-y-auto space-y-3 pr-1 max-h-[500px]">
          {columnTasks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/5 rounded-xl text-zinc-600 text-xs min-h-[150px]">
              <AlertCircle className="h-5 w-5 text-zinc-700 mb-1" />
              <span>No tasks in this sector</span>
            </div>
          ) : (
            columnTasks.map(renderTaskCard)
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in mt-4">
      {renderColumn('todo', 'Todo', todoTasks, 'border-zinc-700/50 shadow-[0_0_15px_rgba(255,255,255,0.01)]', 'bg-zinc-500')}
      {renderColumn('in_progress', 'In Progress', inProgressTasks, 'border-zinc-400/50 shadow-[0_0_20px_rgba(255,255,255,0.03)]', 'bg-zinc-350')}
      {renderColumn('completed', 'Completed', completedTasks, 'border-white/20 shadow-[0_0_25px_rgba(255,255,255,0.06)]', 'bg-white')}
    </div>
  )
}
