import { query } from '@anthropic-ai/claude-agent-sdk'
import * as Sentry from '@sentry/nextjs'

const SYSTEM_PROMPT = `You are a helpful transcript analyzer. When given a transcript, you should:

1. Summarize the key points and main topics discussed
2. Identify important action items or decisions made
3. Extract key insights and takeaways
4. Highlight any questions that were raised or need follow-up

Be concise but thorough. Use markdown formatting for better readability.`

export async function POST(request: Request) {
  return await Sentry.startSpan(
    { name: 'POST /api/analyze-transcript', op: 'http.server' },
    async () => {
      try {
        // Check if Anthropic API key is configured
        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
          const error = new Error('ANTHROPIC_API_KEY is not configured')
          Sentry.logger.error('Anthropic API key missing or not configured', {
            hasKey: !!process.env.ANTHROPIC_API_KEY,
            isPlaceholder: process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here',
          })
          Sentry.captureException(error)

          return new Response(
            JSON.stringify({
              error: 'Anthropic API key is not configured. Please add ANTHROPIC_API_KEY to your .env.local file.'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }

        const { transcript } = await request.json() as { transcript: string }

        if (!transcript || typeof transcript !== 'string') {
          Sentry.logger.warn('Invalid transcript provided', {
            hasTranscript: !!transcript,
            type: typeof transcript,
          })
          return new Response(
            JSON.stringify({ error: 'Transcript is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }

        Sentry.logger.info('Starting transcript analysis', {
          transcriptLength: transcript.length,
        })

    const fullPrompt = `${SYSTEM_PROMPT}

Here is the transcript to analyze:

${transcript}

Please provide a comprehensive analysis of this transcript.`

        // Create a streaming response
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            try {
              // Use the claude-agent-sdk query function
              await Sentry.startSpan(
                { name: 'anthropic-api-query', op: 'ai.chat' },
                async () => {
                  for await (const message of query({
                    prompt: fullPrompt,
                    options: {
                      maxTurns: 5,
                      // Disable tools for simple text analysis
                      tools: { type: 'none' },
                      // Bypass all permission checks for automated tool execution
                      permissionMode: 'bypassPermissions',
                      allowDangerouslySkipPermissions: true,
                      // Enable partial messages for real-time text streaming
                      includePartialMessages: true,
                      // Set working directory to the app's directory
                      cwd: process.cwd(),
                    }
                  })) {
                    // Handle streaming text deltas (partial messages)
                    if (message.type === 'stream_event' && 'event' in message) {
                      const event = message.event
                      // Handle content block delta events for text streaming
                      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                        controller.enqueue(encoder.encode(
                          `data: ${JSON.stringify({ type: 'text_delta', text: event.delta.text })}\n\n`
                        ))
                      }
                    }

                    // Signal completion
                    if (message.type === 'result' && message.subtype === 'success') {
                      Sentry.logger.info('Transcript analysis completed successfully')
                      controller.enqueue(encoder.encode(
                        `data: ${JSON.stringify({ type: 'done' })}\n\n`
                      ))
                    }

                    // Handle errors
                    if (message.type === 'result' && message.subtype !== 'success') {
                      Sentry.logger.error('Analysis did not complete successfully', {
                        messageType: message.type,
                        subtype: message.subtype,
                      })
                      controller.enqueue(encoder.encode(
                        `data: ${JSON.stringify({ type: 'error', message: 'Analysis did not complete successfully' })}\n\n`
                      ))
                    }
                  }
                }
              )

              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              Sentry.logger.error('Stream error during analysis', {
                error: errorMessage,
                errorType: error instanceof Error ? error.constructor.name : typeof error,
              })
              Sentry.captureException(error)

              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  message: 'Failed to connect to Anthropic API. Please check your API key configuration.'
                })}\n\n`
              ))
              controller.close()
            }
          }
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        Sentry.logger.error('Transcript analysis API error', {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        })
        Sentry.captureException(error)

        return new Response(
          JSON.stringify({
            error: 'Failed to process transcript. Please check your Anthropic API key configuration.',
            details: errorMessage,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  )
}
