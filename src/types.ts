export interface SubTask {
  id: string
  title: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  category: string
  dueDate: string
  completed: boolean
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
