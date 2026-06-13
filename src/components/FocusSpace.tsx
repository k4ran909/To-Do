import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, X, Sparkles, Volume2, VolumeX } from 'lucide-react'
import type { Task } from '../types'

interface FocusSpaceProps {
  isOpen: boolean
  onClose: () => void
  task: Task | null
  onRewardXP: (xpAmount: number) => void
}

export const FocusSpace: React.FC<FocusSpaceProps> = ({
  isOpen,
  onClose,
  task,
  onRewardXP
}) => {
  // Timer States: 25 mins (1500 seconds) for focus, 5 mins (300 seconds) for break
  const [sessionType, setSessionType] = useState<'focus' | 'break'>('focus')
  const [timeLeft, setTimeLeft] = useState(1500)
  const [isRunning, setIsRunning] = useState(false)
  const [isSynthPlaying, setIsSynthPlaying] = useState(false)
  const [volume, setVolume] = useState(0.3)

  // Web Audio Synth references
  const audioCtxRef = useRef<AudioContext | null>(null)
  const osc1Ref = useRef<OscillatorNode | null>(null)
  const osc2Ref = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  const initialTime = sessionType === 'focus' ? 1500 : 300

  // Handle countdown
  useEffect(() => {
    if (!isOpen) return

    let intervalId: any = null

    if (isRunning && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      handleSessionComplete()
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isRunning, timeLeft, isOpen])

  // Stop sound if space is closed
  useEffect(() => {
    if (!isOpen) {
      setIsRunning(false)
      stopSynth()
    } else {
      setTimeLeft(sessionType === 'focus' ? 1500 : 300)
    }
    return () => stopSynth()
  }, [isOpen])

  // Web Audio Synth initialization and management
  const startSynth = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      // Stop any existing sound nodes first
      stopSynth()

      // Create nodes
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gainNode = ctx.createGain()

      // Left Channel Oscillator: Sine at 432Hz (harmonic relaxation frequency)
      osc1.type = 'sine'
      osc1.frequency.value = 432

      // Right Channel Oscillator: Sine at 472Hz (432Hz + 40Hz difference for Gamma focus wave)
      osc2.type = 'sine'
      osc2.frequency.value = 472

      gainNode.gain.value = volume

      // Try setting up stereo panning for binaural effect, fallback to mono
      try {
        const panner1 = ctx.createStereoPanner()
        const panner2 = ctx.createStereoPanner()
        panner1.pan.value = -1.0 // Left
        panner2.pan.value = 1.0  // Right

        osc1.connect(panner1).connect(gainNode)
        osc2.connect(panner2).connect(gainNode)
      } catch (e) {
        // Mono connection fallback
        osc1.connect(gainNode)
        osc2.connect(gainNode)
      }

      gainNode.connect(ctx.destination)

      osc1.start()
      osc2.start()

      osc1Ref.current = osc1
      osc2Ref.current = osc2
      gainRef.current = gainNode
      setIsSynthPlaying(true)
    } catch (err) {
      console.error('Failed to initialize Web Audio context:', err)
    }
  }

  const stopSynth = () => {
    try {
      osc1Ref.current?.stop()
      osc2Ref.current?.stop()
      osc1Ref.current?.disconnect()
      osc2Ref.current?.disconnect()
      gainRef.current?.disconnect()
    } catch (e) {
      // Node already stopped
    }
    osc1Ref.current = null
    osc2Ref.current = null
    gainRef.current = null
    setIsSynthPlaying(false)
  }

  const toggleSynth = () => {
    if (isSynthPlaying) {
      stopSynth()
    } else {
      startSynth()
    }
  }

  // Adjust volume dynamically
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume
    }
  }, [volume])

  const handleSessionComplete = () => {
    setIsRunning(false)
    stopSynth()

    // Notify user with audio prompt or browser notification
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain).connect(audioCtx.destination)
      osc.frequency.setValueAtTime(600, audioCtx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.5)
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.6)
    } catch (e) {}

    if (sessionType === 'focus') {
      // Award XP
      onRewardXP(15)
      alert('Focus session completed! Directive executed successfully. Reward: +15XP.')
      setSessionType('break')
      setTimeLeft(300)
    } else {
      alert('Break session completed. Ready to focus again?')
      setSessionType('focus')
      setTimeLeft(1500)
    }
  }

  const toggleTimer = () => {
    if (!isRunning && !isSynthPlaying) {
      // Auto-start ambient synthesizer when focusing
      startSynth()
    }
    setIsRunning(!isRunning)
  }

  const resetTimer = () => {
    setIsRunning(false)
    stopSynth()
    setTimeLeft(initialTime)
  }

  const handleSkip = () => {
    if (confirm('Skip current session directive?')) {
      resetTimer()
      setSessionType(sessionType === 'focus' ? 'break' : 'focus')
      setTimeLeft(sessionType === 'focus' ? 300 : 1500)
    }
  }

  // Formatter helper: 1500 -> 25:00
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60)
    const seconds = secs % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  };

  // SVG ring calculations
  const progressRatio = timeLeft / initialTime
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progressRatio)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl px-4 select-none animate-fade-in text-white">
      {/* Top Bar controls */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-zinc-400 animate-ping" />
          <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
            QUANTUM FOCUS DECK
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full border border-white/5 bg-white/2 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Exit focus mode"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="w-full max-w-sm flex flex-col items-center gap-8 text-center">
        {/* Task Context Title */}
        <div className="space-y-1">
          <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase bg-white/2 border border-white/5 px-2 py-0.5 rounded">
            {sessionType === 'focus' ? 'ACTIVE FOCUS SECTOR' : 'RECALIBRATION BREAK'}
          </span>
          <h2 className="text-xl font-bold tracking-wide font-heading text-white line-clamp-1 max-w-xs mt-2">
            {task ? task.title : 'Deep Work Sync Session'}
          </h2>
        </div>

        {/* Circular Dial Timer */}
        <div className="relative flex items-center justify-center h-56 w-56">
          <svg className="h-full w-full transform -rotate-90">
            {/* Background circle track */}
            <circle
              cx="112"
              cy="112"
              r={radius}
              className="stroke-zinc-900 fill-transparent"
              strokeWidth="5"
            />
            {/* Active dial line */}
            <circle
              cx="112"
              cy="112"
              r={radius}
              className="stroke-white/80 fill-transparent transition-all duration-300"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.15))'
              }}
            />
          </svg>

          {/* Time digits in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono select-all">
            <span className="text-4xl font-extrabold tracking-tighter text-white">
              {formatTime(timeLeft)}
            </span>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
              {sessionType === 'focus' ? 'FOCUSING' : 'BREAK TIME'}
            </span>
          </div>
        </div>

        {/* Controls Layout */}
        <div className="flex flex-col gap-6 w-full px-6">
          {/* Main Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleSkip}
              className="p-3 rounded-xl border border-white/5 bg-white/2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Skip Session"
            >
              <RotateCcw className="h-4 w-4 transform rotate-90" />
            </button>

            <button
              onClick={toggleTimer}
              className="flex items-center justify-center h-14 w-14 rounded-full bg-white text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95 transition-all"
            >
              {isRunning ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
            </button>

            <button
              onClick={resetTimer}
              className="p-3 rounded-xl border border-white/5 bg-white/2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Synthesizer Control Deck */}
          <div className="glass-card p-4 rounded-2xl border border-white/5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-zinc-400 animate-pulse" />
                <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                  Binaural Focus Synth (40Hz Gamma)
                </span>
              </div>
              <button
                onClick={toggleSynth}
                className={`p-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wide px-2.5 transition-all ${
                  isSynthPlaying
                    ? 'border-white/20 bg-white/10 text-white'
                    : 'border-white/5 bg-black/40 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {isSynthPlaying ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setVolume((v) => (v > 0 ? 0 : 0.3))}
                className="text-zinc-400 hover:text-white transition-colors"
                aria-label={volume > 0 ? "Mute synth" : "Unmute synth"}
              >
                {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-zinc-600" />}
              </button>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  setVolume(val)
                  if (val > 0 && !isSynthPlaying) {
                    startSynth()
                  } else if (val === 0 && isSynthPlaying) {
                    stopSynth()
                  }
                }}
                className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
