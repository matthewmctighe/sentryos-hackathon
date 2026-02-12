'use client'

import { useState, useEffect } from 'react'
import { Send, Loader2, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import * as Sentry from '@sentry/nextjs'

interface GongUser {
  id: string
  name: string
  email: string
}

interface GongCall {
  id: string
  title: string
  date: string
  duration: number
  url: string
}

const techConferences = [
  { id: 'conf-1', company: 'AWS', name: 'AWS re:Invent 2024', date: 'Dec 2-6, 2024', location: 'Las Vegas, NV' },
  { id: 'conf-2', company: 'Google', name: 'Google Cloud Next', date: 'Apr 9-11, 2024', location: 'San Francisco, CA' },
  { id: 'conf-3', company: 'Microsoft', name: 'Microsoft Build', date: 'May 21-23, 2024', location: 'Seattle, WA' },
  { id: 'conf-4', company: 'Salesforce', name: 'Dreamforce', date: 'Sep 17-19, 2024', location: 'San Francisco, CA' },
  { id: 'conf-5', company: 'Apple', name: 'WWDC 2024', date: 'Jun 10-14, 2024', location: 'Cupertino, CA' },
  { id: 'conf-6', company: 'Meta', name: 'Meta Connect', date: 'Sep 25-26, 2024', location: 'Menlo Park, CA' },
  { id: 'conf-7', company: 'GitHub', name: 'GitHub Universe', date: 'Oct 29-30, 2024', location: 'San Francisco, CA' },
  { id: 'conf-8', company: 'MongoDB', name: 'MongoDB World', date: 'Jun 4-6, 2024', location: 'New York, NY' },
]

export function TranscriptAnalyzer() {
  const [gongMembers, setGongMembers] = useState<GongUser[]>([])
  const [gongCalls, setGongCalls] = useState<GongCall[]>([])
  const [selectedMember, setSelectedMember] = useState('')
  const [selectedCall, setSelectedCall] = useState('')
  const [selectedConference, setSelectedConference] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [agentResponse, setAgentResponse] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingCalls, setIsLoadingCalls] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch Gong users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true)
        setError(null)
        Sentry.logger.info('Fetching Gong users from client')
        const response = await fetch('/api/gong/users')
        if (!response.ok) {
          throw new Error('Failed to fetch users')
        }
        const data = await response.json()
        setGongMembers(data.users || [])
        Sentry.logger.info('Successfully loaded Gong users', { count: data.users?.length || 0 })
      } catch (err) {
        setError('Failed to load Gong users. Please check your API key configuration.')
        Sentry.logger.error('Error fetching users', { error: err instanceof Error ? err.message : 'Unknown' })
        Sentry.captureException(err)
      } finally {
        setIsLoadingUsers(false)
      }
    }

    fetchUsers()
  }, [])

  const handleMemberChange = async (memberId: string) => {
    setSelectedMember(memberId)
    setSelectedCall('') // Reset call selection when member changes
    setUserPrompt('') // Clear prompt
    setAgentResponse('') // Clear response
    setGongCalls([]) // Clear previous calls

    if (!memberId) return

    // Fetch latest 10 calls for the selected member
    try {
      setIsLoadingCalls(true)
      setError(null)
      Sentry.logger.info('Fetching calls for user', { userId: memberId })
      const response = await fetch(`/api/gong/calls?userId=${memberId}&limit=10`)
      if (!response.ok) {
        throw new Error('Failed to fetch calls')
      }
      const data = await response.json()
      setGongCalls(data.calls || [])
      Sentry.logger.info('Successfully loaded calls', { userId: memberId, count: data.calls?.length || 0 })
    } catch (err) {
      setError('Failed to load calls for this user.')
      Sentry.logger.error('Error fetching calls', { userId: memberId, error: err instanceof Error ? err.message : 'Unknown' })
      Sentry.captureException(err)
    } finally {
      setIsLoadingCalls(false)
    }
  }

  const handleCallChange = (callId: string) => {
    setSelectedCall(callId)
    setAgentResponse('') // Clear previous response
    setUserPrompt('') // Clear prompt
  }

  const handleAnalyze = async () => {
    if (!selectedCall || !userPrompt.trim() || isAnalyzing) return

    setIsAnalyzing(true)
    setAgentResponse('')

    Sentry.logger.info('Starting transcript analysis', {
      callId: selectedCall,
      promptLength: userPrompt.length,
    })

    try {
      // First, fetch the transcript for the selected call
      const transcriptResponse = await fetch(`/api/gong/transcript?callId=${selectedCall}`)
      if (!transcriptResponse.ok) {
        throw new Error('Failed to fetch transcript')
      }
      const transcriptData = await transcriptResponse.json()
      const transcript = transcriptData.transcript || ''

      Sentry.logger.info('Transcript fetched, starting AI analysis', {
        callId: selectedCall,
        transcriptLength: transcript.length,
      })

      // Now analyze the transcript with the user's prompt
      const analysisPrompt = `${userPrompt}\n\nCall Transcript:\n${transcript}`

      const response = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: analysisPrompt })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze transcript')
      }

      // Handle SSE streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let streamingContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'text_delta') {
                streamingContent += parsed.text
                setAgentResponse(streamingContent)
              } else if (parsed.type === 'error') {
                streamingContent = 'Sorry, I encountered an error analyzing the transcript.'
                setAgentResponse(streamingContent)
                Sentry.logger.error('AI analysis error received')
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      Sentry.logger.info('Analysis completed successfully', {
        callId: selectedCall,
        responseLength: streamingContent.length,
      })
    } catch (err) {
      setAgentResponse('Sorry, I encountered an error. Please check your configuration and try again.')
      Sentry.logger.error('Error during analysis', {
        callId: selectedCall,
        error: err instanceof Error ? err.message : 'Unknown',
      })
      Sentry.captureException(err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#1e2a25]">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 md:px-8 py-4 md:py-5 border-b border-[#3d4a30] bg-[#2a3832]">
        <span className="text-2xl md:text-3xl">💬</span>
        <span className="text-base md:text-lg font-medium text-[#e8f0ed]">Transcript Analyzer</span>
        <span className="ml-auto text-xs md:text-sm text-[#90a398]">Created by Le Haq</span>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 space-y-4 md:space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Gong Member and Call Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Member Dropdown */}
          <div className="space-y-2">
            <label className="text-sm md:text-base text-[#c4d4b0] font-medium">
              Select Team Member:
            </label>
            <select
              value={selectedMember}
              onChange={(e) => handleMemberChange(e.target.value)}
              disabled={isLoadingUsers}
              className="w-full bg-white text-[#1a2520] text-sm md:text-base rounded-lg px-3 py-2.5 md:px-4 md:py-3 border border-[#3d4a30] focus:border-[#87A96B] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {isLoadingUsers ? 'Loading users...' : 'Choose a member...'}
              </option>
              {gongMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          {/* Call Dropdown */}
          <div className="space-y-2">
            <label className="text-sm md:text-base text-[#c4d4b0] font-medium">
              Select Call:
            </label>
            <select
              value={selectedCall}
              onChange={(e) => handleCallChange(e.target.value)}
              disabled={!selectedMember || isLoadingCalls}
              className="w-full bg-white text-[#1a2520] text-sm md:text-base rounded-lg px-3 py-2.5 md:px-4 md:py-3 border border-[#3d4a30] focus:border-[#87A96B] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {isLoadingCalls ? 'Loading calls...' : 'Choose a call...'}
              </option>
              {gongCalls.map((call) => (
                <option key={call.id} value={call.id}>
                  {call.title} ({call.date})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tech Conference Selection */}
        <div className="space-y-2">
          <label className="text-sm md:text-base text-[#c4d4b0] font-medium">
            Reference Tech Conference (Optional):
          </label>
          <select
            value={selectedConference}
            onChange={(e) => setSelectedConference(e.target.value)}
            className="w-full bg-white text-[#1a2520] text-sm md:text-base rounded-lg px-3 py-2.5 md:px-4 md:py-3 border border-[#3d4a30] focus:border-[#87A96B] focus:outline-none"
          >
            <option value="">Choose a conference...</option>
            {techConferences.map((conf) => (
              <option key={conf.id} value={conf.id}>
                {conf.company} - {conf.name} | {conf.date} | {conf.location}
              </option>
            ))}
          </select>
        </div>

        {/* Prompt Input Section */}
        <div className="space-y-2">
          <label className="text-sm md:text-base text-[#c4d4b0] font-medium">
            Your Prompt:
          </label>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Ask a question about this call (e.g., 'Provide Sentry best practices based on this conversation')"
            className="w-full h-32 bg-white text-[#1a2520] text-sm md:text-base rounded-lg px-3 py-3 md:px-4 md:py-3 border border-[#3d4a30] focus:border-[#87A96B] focus:outline-none resize-none placeholder:text-[#6b7c6b]"
            disabled={isAnalyzing || !selectedCall}
          />
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !selectedCall || !userPrompt.trim()}
          className="w-full px-4 py-3 md:px-6 md:py-3 bg-[#87A96B] hover:bg-[#9DC88D] disabled:bg-[#3d4a30] disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2 text-white font-medium"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm md:text-base">Analyzing Call...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span className="text-sm md:text-base">Analyze Selected Call</span>
            </>
          )}
        </button>

        {/* Agent Response */}
        {agentResponse && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#87A96B]" />
              <label className="text-sm md:text-base text-[#c4d4b0] font-medium">
                Agent Response:
              </label>
            </div>
            <div className="bg-[#2a3832] rounded-lg px-4 py-4 md:px-5 md:py-5 border border-[#3d4a30]">
              <div className="text-sm md:text-base text-[#e8f0ed] chat-markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const isInline = !match && !String(children).includes('\n')
                      return isInline ? (
                        <code className="bg-[#1e2a25] px-1.5 py-0.5 rounded text-[#9DC88D] text-xs" {...props}>
                          {children}
                        </code>
                      ) : (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match ? match[1] : 'text'}
                          PreTag="div"
                          customStyle={{
                            margin: '0.5rem 0',
                            padding: '0.75rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                            background: '#1e2a25',
                          }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      )
                    },
                    a({ href, children }) {
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#87A96B] hover:text-[#c4d4b0] underline">
                          {children}
                        </a>
                      )
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside my-1 space-y-0.5">{children}</ul>
                    },
                    ol({ children }) {
                      return <ol className="list-decimal list-inside my-1 space-y-0.5">{children}</ol>
                    },
                    li({ children }) {
                      return <li className="text-sm">{children}</li>
                    },
                    p({ children }) {
                      return <p className="my-1">{children}</p>
                    },
                    h1({ children }) {
                      return <h1 className="text-lg font-bold mt-2 mb-1 text-[#e8e4f0]">{children}</h1>
                    },
                    h2({ children }) {
                      return <h2 className="text-base font-semibold mt-2 mb-1 text-[#c4d4b0]">{children}</h2>
                    },
                    h3({ children }) {
                      return <h3 className="text-sm font-semibold mt-1.5 mb-0.5 text-[#c4d4b0]">{children}</h3>
                    },
                    blockquote({ children }) {
                      return <blockquote className="border-l-2 border-[#87A96B] pl-2 my-1 text-[#9086a3] italic">{children}</blockquote>
                    },
                  }}
                >
                  {agentResponse}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
