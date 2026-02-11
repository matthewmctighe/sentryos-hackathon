'use client'

import { TranscriptAnalyzer } from '@/components/desktop/apps/TranscriptAnalyzer'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c14] via-[#1a1625] to-[#0f0c14] flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl h-[90vh] max-h-[900px] bg-[#1e1a2a] rounded-lg shadow-2xl border border-[#3d4a30]/30 overflow-hidden">
        <TranscriptAnalyzer />
      </div>
    </div>
  )
}
