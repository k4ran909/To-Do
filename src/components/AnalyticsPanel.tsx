import React, { useMemo } from 'react'
import { Award, Target, CheckCircle2, TrendingUp } from 'lucide-react'
import type { Task, Category } from '../types'

interface AnalyticsPanelProps {
  tasks: Task[]
  categories: Category[]
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ tasks, categories }) => {
  // 1. Calculate General Stats
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.completed).length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const highPriorityCount = tasks.filter((t) => t.priority === 'high' && !t.completed).length
  const totalXPEarned = tasks.filter((t) => t.completed).reduce((acc, t) => acc + t.xpReward, 0)

  // 2. Weekly Completion Data (Past 7 Days)
  const weeklyCompletionData = useMemo(() => {
    const data = []
    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(today.getDate() - i)
      const dateString = d.toDateString()

      // Count tasks created/completed on this day (simulated completedAt or using createdAt)
      // Since we don't have completedAt, we filter completed tasks by their createdAt date to approximate completion velocity
      const count = tasks.filter((t) => {
        if (!t.completed) return false
        const createdDate = new Date(t.createdAt).toDateString()
        return createdDate === dateString
      }).length

      data.push({
        dayName: d.toLocaleDateString([], { weekday: 'short' }),
        count
      })
    }
    return data
  }, [tasks])

  // Calculations for line chart SVG
  const lineChartPath = useMemo(() => {
    if (weeklyCompletionData.length === 0) return ''
    const width = 450
    const height = 150
    const padding = 25
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    const maxVal = Math.max(...weeklyCompletionData.map((d) => d.count), 4)

    // Generate points
    const points = weeklyCompletionData.map((d, i) => {
      const x = padding + (i / 6) * chartWidth
      const y = height - padding - (d.count / maxVal) * chartHeight
      return { x, y }
    })

    // Create SVG bezier curve path
    let dAttr = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i]
      const next = points[i + 1]
      const cpX1 = curr.x + (next.x - curr.x) / 2
      const cpY1 = curr.y
      const cpX2 = curr.x + (next.x - curr.x) / 2
      const cpY2 = next.y
      dAttr += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`
    }

    // Gradient fill path (closes loop at the bottom)
    const fillDAttr = `${dAttr} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

    return { points, linePath: dAttr, fillPath: fillDAttr, maxVal }
  }, [weeklyCompletionData])

  // 3. Category Load Distribution (Donut Chart)
  const categoryData = useMemo(() => {
    const dist: Record<string, number> = {}
    tasks.forEach((t) => {
      dist[t.category] = (dist[t.category] || 0) + 1
    })

    const data = categories
      .map((cat) => {
        const count = dist[cat.id] || 0
        return {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          count
        }
      })
      .filter((c) => c.count > 0)


    
    // Add Inbox default if there are tasks in it but it is not in custom categories list
    if (dist['inbox'] && !data.some((c) => c.id === 'inbox')) {
      const inboxCat = categories.find((c) => c.id === 'inbox')
      data.push({
        id: 'inbox',
        name: inboxCat?.name || 'Inbox',
        color: inboxCat?.color || '#a1a1aa',
        count: dist['inbox']
      })
    }

    const finalSum = data.reduce((acc, c) => acc + c.count, 0)

    return data.map((d) => ({
      ...d,
      percentage: finalSum > 0 ? Math.round((d.count / finalSum) * 100) : 0
    }))
  }, [tasks, categories])

  // Calculate donut chart segments coordinates
  const donutSegments = useMemo(() => {
    let accumulatedPercentage = 0
    const radius = 60
    const circumference = 2 * Math.PI * radius

    return categoryData.map((d) => {
      const strokeOffset = circumference - (d.percentage / 100) * circumference
      const strokeDash = `${(d.percentage / 100) * circumference} ${circumference}`
      const rotation = (accumulatedPercentage / 100) * 360
      accumulatedPercentage += d.percentage

      return {
        ...d,
        strokeOffset,
        strokeDash,
        rotation,
        circumference
      }
    })
  }, [categoryData])

  return (
    <div className="space-y-6 animate-fade-in mt-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-white/3 border border-white/10 rounded-xl text-white">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-zinc-500 uppercase">Completions</span>
            <span className="text-xl font-bold font-heading text-white">{completedTasks} <span className="text-xs text-zinc-500 font-normal">/ {totalTasks}</span></span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-white/3 border border-white/10 rounded-xl text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-zinc-500 uppercase">Success Rate</span>
            <span className="text-xl font-bold font-heading text-white">{completionRate}%</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-white/3 border border-white/10 rounded-xl text-white">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-zinc-500 uppercase">Total XP Looted</span>
            <span className="text-xl font-bold font-heading text-white">+{totalXPEarned} XP</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3 bg-white/3 border border-white/10 rounded-xl text-white">
            <Target className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-zinc-500 uppercase">Threat Level</span>
            <span className="text-xl font-bold font-heading text-white">{highPriorityCount} <span className="text-xs text-zinc-500 font-normal">critical</span></span>
          </div>
        </div>
      </div>

      {/* Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Completion Curve - 7 Columns */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-7 flex flex-col gap-4">
          <div>
            <h4 className="text-white font-semibold text-sm font-heading tracking-wide">XP Velocity Curve</h4>
            <p className="text-[10px] text-zinc-500 font-mono uppercase">COMPLETED DIRECTIVES PER DAY</p>
          </div>

          {/* SVG Line Chart */}
          <div className="w-full h-44 bg-zinc-950/40 rounded-xl border border-white/2 flex items-center justify-center p-2 relative overflow-hidden">
            {totalTasks === 0 ? (
              <div className="text-center text-zinc-600 text-xs py-10 font-mono">
                INITIALIZING VELOCITY MONITOR... (NO DATA)
              </div>
            ) : (
              <svg viewBox="0 0 450 150" className="w-full h-full">
                <defs>
                  {/* Holographic Gradient fill */}
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="25" y1="25" x2="425" y2="25" className="stroke-white/5" strokeDasharray="3 3" />
                <line x1="25" y1="75" x2="425" y2="75" className="stroke-white/5" strokeDasharray="3 3" />
                <line x1="25" y1="125" x2="425" y2="125" className="stroke-white/5" strokeDasharray="3 3" />

                {/* Paths */}
                {lineChartPath && (
                  <>
                    {/* Shadow/Glow Path */}
                    <path
                      d={lineChartPath.linePath}
                      fill="none"
                      className="stroke-white/20"
                      strokeWidth="4"
                      style={{ filter: 'blur(3px)' }}
                    />
                    {/* Gradient Area Fill */}
                    <path d={lineChartPath.fillPath} fill="url(#lineGrad)" />
                    {/* Active Line Path */}
                    <path d={lineChartPath.linePath} fill="none" className="stroke-white/80" strokeWidth="2.5" />

                    {/* Interactive dots */}
                    {lineChartPath.points.map((pt, idx) => (
                      <g key={idx}>
                        <circle cx={pt.x} cy={pt.y} r="6" className="fill-zinc-950 stroke-white/40" strokeWidth="1.5" />
                        <circle cx={pt.x} cy={pt.y} r="3" className="fill-white" />
                      </g>
                    ))}
                  </>
                )}

                {/* X Axis Labels */}
                {weeklyCompletionData.map((d, i) => {
                  const x = 25 + (i / 6) * 400
                  return (
                    <text
                      key={i}
                      x={x}
                      y="145"
                      textAnchor="middle"
                      className="fill-zinc-500 font-mono text-[9px] font-semibold"
                    >
                      {d.dayName}
                    </text>
                  )
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Category Load - 5 Columns */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-5 flex flex-col gap-4">
          <div>
            <h4 className="text-white font-semibold text-sm font-heading tracking-wide">Sector Allocation</h4>
            <p className="text-[10px] text-zinc-500 font-mono uppercase">TASK DENSITY BY CATEGORY</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 flex-grow">
            {/* SVG Donut Chart */}
            <div className="flex justify-center">
              {totalTasks === 0 ? (
                <div className="h-32 w-32 rounded-full border border-dashed border-white/5 flex items-center justify-center text-[10px] text-zinc-700 font-mono">
                  NO ALLOCATIONS
                </div>
              ) : (
                <div className="relative h-32 w-32 flex items-center justify-center">
                  <svg viewBox="0 0 160 160" className="h-full w-full transform -rotate-90">
                    {donutSegments.map((seg, idx) => (
                      <circle
                        key={idx}
                        cx="80"
                        cy="80"
                        r="60"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="10"
                        strokeDasharray={`${2 * Math.PI * 60}`}
                        strokeDashoffset={seg.strokeOffset}
                        transform={`rotate(${seg.rotation}, 80, 80)`}
                        className="transition-all duration-500"
                        style={{
                          filter: 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.05))'
                        }}
                      />
                    ))}
                  </svg>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                    <span className="text-xl font-bold text-white font-heading">{totalTasks}</span>
                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">TOTAL TASKS</span>
                  </div>
                </div>
              )}
            </div>

            {/* Legend list */}
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {categoryData.length === 0 ? (
                <span className="text-[10px] font-mono text-zinc-600 italic">No tasks indexed</span>
              ) : (
                categoryData.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-[10px] font-mono">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-zinc-400 truncate">{d.name}</span>
                    </div>
                    <span className="text-white font-semibold flex-shrink-0">{d.percentage}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
