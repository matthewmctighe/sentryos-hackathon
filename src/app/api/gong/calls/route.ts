import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import type { GongCallsResponse } from '@/types/gong'

const GONG_ACCESS_KEY = process.env.GONG_ACCESS_KEY || process.env.GONG_API_KEY
const GONG_ACCESS_KEY_SECRET = process.env.GONG_ACCESS_KEY_SECRET
const GONG_API_BASE_URL = process.env.GONG_API_BASE_URL || 'https://api.gong.io/v2'

export async function GET(request: NextRequest) {
  return await Sentry.startSpan(
    { name: 'GET /api/gong/calls', op: 'http.server' },
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
        const userId = searchParams.get('userId')
        const limit = searchParams.get('limit') || '10'

        if (!userId) {
          Sentry.logger.warn('Missing userId parameter in request')
          return NextResponse.json(
            { error: 'userId parameter is required' },
            { status: 400 }
          )
        }

        Sentry.logger.info('Fetching Gong calls', { userId, limit })

        // Get calls from the last 30 days
        const toDate = new Date().toISOString()
        const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

        const requestBody = {
          filter: {
            fromDateTime: fromDate,
            toDateTime: toDate,
            primaryUsers: [userId],
          },
          contentSelector: {
            exposedFields: {
              parties: true,
              content: {
                topics: true,
              },
            },
          },
        }

        // Create Basic Auth header: base64(access_key:access_key_secret)
        const credentials = Buffer.from(`${GONG_ACCESS_KEY}:${GONG_ACCESS_KEY_SECRET}`).toString('base64')

        const response = await Sentry.startSpan(
          {
            name: 'fetch-gong-calls',
            op: 'http.client',
            attributes: {
              userId,
              fromDate,
              toDate,
            }
          },
          async () => {
            return await fetch(`${GONG_API_BASE_URL}/calls/extensive`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            })
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          Sentry.logger.error('Gong API request failed', {
            userId,
            status: response.status,
            error: errorText,
          })
          return NextResponse.json(
            { error: 'Failed to fetch calls from Gong API', details: errorText },
            { status: response.status }
          )
        }

        const data: GongCallsResponse = await response.json()

        // Format response with relevant call information
        const formattedCalls = data.calls.map(call => ({
          id: call.metaData.id,
          title: call.metaData.title,
          date: new Date(call.metaData.started).toISOString().split('T')[0],
          duration: call.metaData.duration,
          url: call.metaData.url,
          started: call.metaData.started,
          parties: call.parties.map(party => ({
            name: party.name,
            email: party.emailAddress,
            affiliation: party.affiliation,
          })),
        }))

        Sentry.logger.info('Successfully fetched Gong calls', {
          userId,
          callsCount: formattedCalls.length,
          totalRecords: data.records.totalRecords,
        })

        return NextResponse.json({
          calls: formattedCalls,
          total: data.records.totalRecords,
        })
      } catch (error) {
        Sentry.logger.error('Error fetching Gong calls', {
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
