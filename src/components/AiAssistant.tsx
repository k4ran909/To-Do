import React, { useState } from 'react'
import { Brain, Sparkles, AlertCircle, Check, Loader2 } from 'lucide-react'

interface AiAssistantProps {
  taskTitle: string
  taskDescription: string
  onAddSubtasks: (subtasks: string[]) => void
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  taskTitle,
  taskDescription,
  onAddSubtasks
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [generatedItems, setGeneratedItems] = useState<string[]>([])

  const getMockChecklist = (title: string, desc: string): string[] => {
    const text = (title + ' ' + desc).toLowerCase()
    
    if (text.includes('code') || text.includes('develop') || text.includes('build') || text.includes('api') || text.includes('bug') || text.includes('fix') || text.includes('react') || text.includes('component')) {
      return [
        'Analyze parameters & establish TypeScript typings',
        'Scaffold primary module & write functional body code',
        'Configure boundary validation & catch execution exceptions',
        'Execute developer unit tests & verify build compliance'
      ]
    }
    
    if (text.includes('design') || text.includes('ui') || text.includes('ux') || text.includes('css') || text.includes('style') || text.includes('figma') || text.includes('layout')) {
      return [
        'Research style precedents & set color scales/typographies',
        'Produce interactive layouts & wireframes',
        'Code clean CSS queries & check responsive breakpoints',
        'Refine alignment details & review with stakeholders'
      ]
    }
    
    if (text.includes('write') || text.includes('content') || text.includes('draft') || text.includes('blog') || text.includes('article') || text.includes('report') || text.includes('copy')) {
      return [
        'Map central outline & identify major milestones',
        'Draft section paragraphs & integrate key references',
        'Proofread text flow, editing grammar and style details',
        'Export completed copy & publish to target system'
      ]
    }

    if (text.includes('meet') || text.includes('plan') || text.includes('schedule') || text.includes('call') || text.includes('project') || text.includes('event')) {
      return [
        'Draft meeting agenda outline & specify goals',
        'Invite participants & lock calendar slots',
        'Pre-read materials & distribute workspace brief',
        'Summarize critical decisions & assign next actions'
      ]
    }

    // Default checklist fallback
    return [
      'Deconstruct directive specs & schedule timeline milestones',
      'Establish baseline scaffold & develop structural elements',
      'Execute check protocols to assert complete correct performance',
      'Publish finalized artifacts & clear directive logs'
    ]
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    setGeneratedItems([])

    // Simulate cyber scanning delay
    await new Promise((resolve) => setTimeout(resolve, 1200))

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('aether_gemini_api_key')

      if (apiKey) {
        // Live Gemini API call
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are Aether AI. Deconstruct this task into a clean checklist of exactly 3-4 short, highly actionable subtasks (each under 8 words). Task: "${taskTitle}". Description: "${taskDescription}". Output ONLY a valid JSON array of strings, e.g., ["Subtask 1", "Subtask 2"]. Do not include markdown wraps (like \`\`\`json) or other conversational fillers.`
                    }
                  ]
                }
              ],
              generationConfig: {
                responseMimeType: "application/json"
              }
            })
          }
        )

        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`)
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleanedText)
        
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
          setGeneratedItems(parsed)
          return
        } else {
          throw new Error('Response format is not a string array.')
        }
      } else {
        // Graceful mockup parser fallback
        const mockItems = getMockChecklist(taskTitle, taskDescription)
        setGeneratedItems(mockItems)
      }
    } catch (err) {
      console.warn('AI compilation failed, running local heuristic fallback...', err)
      const mockItems = getMockChecklist(taskTitle, taskDescription)
      setGeneratedItems(mockItems)
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = () => {
    if (generatedItems.length > 0) {
      onAddSubtasks(generatedItems)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setGeneratedItems([])
      }, 2000)
    }
  }

  return (
    <div className="glass-card p-4 rounded-xl border border-white/5 bg-zinc-950/30 flex flex-col gap-3 font-mono text-[11px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-300">
          <Brain className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-bold uppercase tracking-wider">Aether AI Subtask Synthesizer</span>
        </div>
        <span className="text-[9px] text-zinc-600 uppercase tracking-widest">GEMINI READY</span>
      </div>

      {generatedItems.length === 0 && !loading && !success && (
        <div className="flex items-center justify-between gap-4 py-1.5 border-t border-dashed border-white/5">
          <span className="text-zinc-500">Analyze directive layout & generate checklist matrices.</span>
          <button
            onClick={handleGenerate}
            className="interactive-control flex items-center gap-1.5 px-3 py-1 bg-white text-zinc-950 rounded-lg hover:scale-[1.02] transition-transform font-bold font-mono tracking-wide"
          >
            <Sparkles className="h-3 w-3" />
            <span>SYNTHESIZE</span>
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-3 text-zinc-400 animate-pulse border-t border-dashed border-white/5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-350" />
          <span>DECONSTRUCTING DIRECTIVE VECTOR & COMPILING CHECKLIST...</span>
        </div>
      )}

      {generatedItems.length > 0 && !loading && !success && (
        <div className="space-y-3 pt-2 border-t border-dashed border-white/5">
          <div className="space-y-1.5">
            {generatedItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-zinc-400">
                <span className="text-zinc-600 mt-0.5">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setGeneratedItems([])}
              className="px-2.5 py-1 rounded text-zinc-500 hover:text-white transition-colors border border-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleCommit}
              className="flex items-center gap-1.5 px-3 py-1 bg-white text-zinc-950 font-bold rounded hover:scale-105 active:scale-95 transition-all"
            >
              <Check className="h-3.5 w-3.5" />
              <span>COMMIT MATRIX</span>
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-zinc-300 py-3 border-t border-dashed border-white/5 animate-fade-in">
          <Check className="h-4 w-4 text-white animate-bounce" />
          <span>SUBTASK DIRECTIVES COMMITTED TO TASK DATA.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-rose-400 py-2 border-t border-dashed border-white/5">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
