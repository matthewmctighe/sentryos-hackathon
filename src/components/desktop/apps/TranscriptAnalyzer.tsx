'use client'

import { useState } from 'react'
import { Send, Loader2, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Mock data - replace with actual Gong API integration
const gongMembers = [
  { id: '1', name: 'Sarah Chen' },
  { id: '2', name: 'Michael Rodriguez' },
  { id: '3', name: 'Emily Watson' },
  { id: '4', name: 'James Kim' },
]

const gongCalls = {
  '1': [
    { id: 'call-1-1', title: 'Q4 Sales Review - Acme Corp', date: '2024-02-08' },
    { id: 'call-1-2', title: 'Product Demo - TechStart Inc', date: '2024-02-07' },
  ],
  '2': [
    { id: 'call-2-1', title: 'Customer Success Check-in', date: '2024-02-08' },
    { id: 'call-2-2', title: 'Enterprise Deal Discussion', date: '2024-02-06' },
  ],
  '3': [
    { id: 'call-3-1', title: 'Partnership Strategy Call', date: '2024-02-09' },
    { id: 'call-3-2', title: 'Team Sync - Q1 Goals', date: '2024-02-05' },
  ],
  '4': [
    { id: 'call-4-1', title: 'Feature Request Review', date: '2024-02-08' },
    { id: 'call-4-2', title: 'Client Onboarding - GlobalTech', date: '2024-02-04' },
  ],
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
  const [selectedMember, setSelectedMember] = useState('')
  const [selectedCall, setSelectedCall] = useState('')
  const [selectedConference, setSelectedConference] = useState('')
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleMemberChange = (memberId: string) => {
    setSelectedMember(memberId)
    setSelectedCall('') // Reset call selection when member changes
    setTranscript('') // Clear transcript
    setAnalysis('') // Clear analysis
  }

  const handleCallChange = (callId: string) => {
    setSelectedCall(callId)
    setAnalysis('') // Clear previous analysis

    // TODO: Fetch actual transcript from Gong API
    // For now, set a mock transcript
    const mockTranscript = `[Mock Transcript for Call ID: ${callId}]

This is a placeholder transcript. In a real implementation, this would be fetched from the Gong API based on the selected call.

The transcript would contain the full conversation from the selected call, including timestamps and speaker identification.`

    setTranscript(mockTranscript)
  }

  const handleAnalyze = async () => {
    if (!transcript.trim() || isAnalyzing) return

    setIsAnalyzing(true)
    setAnalysis('')

    try {
      const response = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: transcript.trim() })
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
                setAnalysis(streamingContent)
              } else if (parsed.type === 'error') {
                streamingContent = 'Sorry, I encountered an error analyzing the transcript.'
                setAnalysis(streamingContent)
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch {
      setAnalysis('Sorry, I encountered an error. Please check your Claude credentials are configured correctly.')
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
              className="w-full bg-white text-[#1a2520] text-sm md:text-base rounded-lg px-3 py-2.5 md:px-4 md:py-3 border border-[#3d4a30] focus:border-[#87A96B] focus:outline-none"
            >
              <option value="">Choose a member...</option>
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
              disabled={!selectedMember}
              className="w-full bg-white text-[#1a2520] text-sm md:text-base rounded-lg px-3 py-2.5 md:px-4 md:py-3 border border-[#3d4a30] focus:border-[#87A96B] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Choose a call...</option>
              {selectedMember && gongCalls[selectedMember as keyof typeof gongCalls]?.map((call) => (
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

        {/* Input Section */}
        <div className="space-y-2">
          <label className="text-sm md:text-base text-[#c4d4b0] font-medium">
            Transcript:
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your transcript here..."
            className="w-full h-48 sm:h-56 md:h-64 bg-white text-[#1a2520] text-sm md:text-base rounded-lg px-3 py-3 md:px-4 md:py-3 border border-[#3d4a30] focus:border-[#87A96B] focus:outline-none resize-none placeholder:text-[#2a5a3b]"
            disabled={isAnalyzing}
          />
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !transcript.trim()}
          className="w-full px-4 py-3 md:px-6 md:py-3 bg-[#87A96B] hover:bg-[#9DC88D] disabled:bg-[#3d4a30] disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2 text-white font-medium"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm md:text-base">Analyzing...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span className="text-sm md:text-base">Analyze Transcript</span>
            </>
          )}
        </button>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#87A96B]" />
              <label className="text-sm md:text-base text-[#c4d4b0] font-medium">
                Analysis:
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
                  {analysis}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
