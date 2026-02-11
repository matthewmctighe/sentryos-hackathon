'use client'

import { useState } from 'react'
import { FileText, Send, Loader2, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export function TranscriptAnalyzer() {
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

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
    <div className="h-full flex flex-col bg-[#1e1a2a]">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 md:px-8 py-4 md:py-5 border-b border-[#3d4a30] bg-[#2a2438]">
        <FileText className="w-5 h-5 md:w-6 md:h-6 text-[#87A96B]" />
        <span className="text-base md:text-lg font-medium text-[#e8e4f0]">Transcript Analyzer</span>
        <span className="ml-auto text-xs md:text-sm text-[#9086a3]">Powered by Claude</span>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 space-y-4 md:space-y-6">
        {/* Input Section */}
        <div className="space-y-2">
          <label className="text-sm md:text-base text-[#c4d4b0] font-medium">
            Paste your transcript below:
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your transcript here..."
            className="w-full h-48 sm:h-56 md:h-64 bg-[#2a2438] text-[#e8e4f0] text-sm md:text-base rounded-lg px-3 py-3 md:px-4 md:py-3 border border-[#3d4a30] focus:border-[#87A96B] focus:outline-none resize-none placeholder:text-[#9086a3]"
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
            <div className="bg-[#2a2438] rounded-lg px-4 py-4 md:px-5 md:py-5 border border-[#3d4a30]">
              <div className="text-sm md:text-base text-[#e8e4f0] chat-markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const isInline = !match && !String(children).includes('\n')
                      return isInline ? (
                        <code className="bg-[#1e1a2a] px-1.5 py-0.5 rounded text-[#9DC88D] text-xs" {...props}>
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
                            background: '#1e1a2a',
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
