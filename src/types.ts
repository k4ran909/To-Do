export interface SubTask {
  id: string
  title: string
  completed: boolean
}

export interface Category {
  id: string
  name: string
  color: string
  glowColor: string
  disabled?: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  category: string
  dueDate: string
  completed: boolean
  inProgress?: boolean
  subtasks: SubTask[]
  xpReward: number
  createdAt: string
}

export interface UserProfile {
  xp: number
  level: number
  streak: number
  lastCompletedDate: string | null
  totalCompletedTasks: number
}
