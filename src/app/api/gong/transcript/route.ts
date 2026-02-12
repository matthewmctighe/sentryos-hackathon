import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import type { GongTranscript } from '@/types/gong'

const GONG_ACCESS_KEY = process.env.GONG_ACCESS_KEY || process.env.GONG_API_KEY
const GONG_ACCESS_KEY_SECRET = process.env.GONG_ACCESS_KEY_SECRET
const GONG_API_BASE_URL = process.env.GONG_API_BASE_URL || 'https://api.gong.io/v2'

export async function GET(request: NextRequest) {
  return await Sentry.startSpan(
    { name: 'GET /api/gong/transcript', op: 'http.server' },
    async () => {
      try {
        if (!GONG_ACCESS_KEY || !GONG_ACCESS_KEY_SECRET) {
          Sentry.logger.error('Gong API credentials not configured')
          return NextResponse.json(
            { error: 'GONG_ACCESS_KEY and GONG_ACCESS_KEY_SECRET are required' },
            { status: 500 }
          )
        }

        const searchParams = request.nextUrl.searchParams
        const callId = searchParams.get('callId')

        if (!callId) {
          Sentry.logger.warn('Missing callId parameter in request')
          return NextResponse.json(
            { error: 'callId parameter is required' },
            { status: 400 }
          )
        }

        Sentry.logger.info('Fetching Gong transcript', { callId })

        // Create Basic Auth header: base64(access_key:access_key_secret)
        const credentials = Buffer.from(`${GONG_ACCESS_KEY}:${GONG_ACCESS_KEY_SECRET}`).toString('base64')

        // First, get the call details using /v2/calls/extensive
        const callResponse = await Sentry.startSpan(
          {
            name: 'fetch-call-details',
            op: 'http.client',
            attributes: { callId }
          },
          async () => {
            return await fetch(
              `${GONG_API_BASE_URL}/calls/extensive?callIds=${callId}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Basic ${credentials}`,
                  'Content-Type': 'application/json',
                },
              }
            )
          }
        )

        if (!callResponse.ok) {
          const errorText = await callResponse.text()
          Sentry.logger.error('Failed to fetch call details', {
            callId,
            status: callResponse.status,
            error: errorText,
          })
          return NextResponse.json(
            { error: 'Failed to fetch call details from Gong API', details: errorText },
            { status: callResponse.status }
          )
        }

        const callData = await callResponse.json()

        // Get the transcript
        const transcriptResponse = await Sentry.startSpan(
          {
            name: 'fetch-transcript',
            op: 'http.client',
            attributes: { callId }
          },
          async () => {
            return await fetch(
              `${GONG_API_BASE_URL}/calls/transcript?callId=${callId}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Basic ${credentials}`,
                  'Content-Type': 'application/json',
                },
              }
            )
          }
        )

        if (!transcriptResponse.ok) {
          const errorText = await transcriptResponse.text()
          Sentry.logger.error('Failed to fetch transcript', {
            callId,
            status: transcriptResponse.status,
            error: errorText,
          })
          return NextResponse.json(
            { error: 'Failed to fetch transcript from Gong API', details: errorText },
            { status: transcriptResponse.status }
          )
        }

        const transcriptData: GongTranscript = await transcriptResponse.json()

    // Format the transcript into readable text
    let formattedTranscript = ''

    if (callData.calls && callData.calls.length > 0) {
      const call = callData.calls[0]
      formattedTranscript += `Call: ${call.metaData.title}\n`
      formattedTranscript += `Date: ${new Date(call.metaData.started).toLocaleString()}\n`
      formattedTranscript += `Duration: ${Math.round(call.metaData.duration / 60)} minutes\n\n`
      formattedTranscript += `--- TRANSCRIPT ---\n\n`
    }

    // Build speaker map from call parties
    const speakerMap = new Map<string, string>()
    if (callData.calls && callData.calls.length > 0) {
      callData.calls[0].parties?.forEach((party: { id: string; name?: string; emailAddress?: string }) => {
        speakerMap.set(party.id, party.name || party.emailAddress || 'Unknown Speaker')
      })
    }

    // Format transcript with speakers and timestamps
    transcriptData.transcript?.forEach((segment) => {
      const speakerName = speakerMap.get(segment.speakerId) || `Speaker ${segment.speakerId}`

      segment.sentences?.forEach((sentence) => {
        const timestamp = new Date(sentence.start * 1000).toISOString().substr(11, 8)
        formattedTranscript += `[${timestamp}] ${speakerName}: ${sentence.text}\n`
      })

      formattedTranscript += '\n'
    })

        Sentry.logger.info('Successfully fetched transcript', {
          callId,
          transcriptLength: formattedTranscript.length,
          segmentCount: transcriptData.transcript?.length || 0,
        })

        return NextResponse.json({
          callId,
          transcript: formattedTranscript,
          rawTranscript: transcriptData,
          callDetails: callData.calls?.[0],
        })
      } catch (error) {
        Sentry.logger.error('Error fetching Gong transcript', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        Sentry.captureException(error)
        return NextResponse.json(
          { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    }
  )
}
