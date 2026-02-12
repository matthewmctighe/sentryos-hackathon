import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import type { GongUsersResponse } from '@/types/gong'

const GONG_ACCESS_KEY = process.env.GONG_ACCESS_KEY || process.env.GONG_API_KEY
const GONG_ACCESS_KEY_SECRET = process.env.GONG_ACCESS_KEY_SECRET
const GONG_API_BASE_URL = process.env.GONG_API_BASE_URL || 'https://api.gong.io/v2'

export async function GET() {
  return await Sentry.startSpan(
    { name: 'GET /api/gong/users', op: 'http.server' },
    async () => {
      try {
        if (!GONG_ACCESS_KEY || !GONG_ACCESS_KEY_SECRET) {
          Sentry.logger.error('Gong API credentials not configured')
          return NextResponse.json(
            { error: 'GONG_ACCESS_KEY and GONG_ACCESS_KEY_SECRET are required' },
            { status: 500 }
          )
        }

        Sentry.logger.info('Fetching Gong users')

        // Create Basic Auth header: base64(access_key:access_key_secret)
        const credentials = Buffer.from(`${GONG_ACCESS_KEY}:${GONG_ACCESS_KEY_SECRET}`).toString('base64')

        const response = await Sentry.startSpan(
          { name: 'fetch-gong-users', op: 'http.client' },
          async () => {
            return await fetch(`${GONG_API_BASE_URL}/users`, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json',
              },
            })
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          Sentry.logger.error('Gong API request failed', {
            status: response.status,
            error: errorText,
          })
          return NextResponse.json(
            { error: 'Failed to fetch users from Gong API', details: errorText },
            { status: response.status }
          )
        }

        const data: GongUsersResponse = await response.json()

        // Filter active users and format response
        const activeUsers = data.users
          .filter(user => user.active)
          .map(user => ({
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.emailAddress,
          }))

        Sentry.logger.info('Successfully fetched Gong users', {
          totalUsers: data.users.length,
          activeUsers: activeUsers.length,
        })

        return NextResponse.json({ users: activeUsers })
      } catch (error) {
        Sentry.logger.error('Error fetching Gong users', {
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
