import { query } from '@anthropic-ai/claude-agent-sdk'

const SYSTEM_PROMPT = `You are a helpful transcript analyzer. When given a transcript, you should:

1. Summarize the key points and main topics discussed
2. Identify important action items or decisions made
3. Extract key insights and takeaways
4. Highlight any questions that were raised or need follow-up

Be concise but thorough. Use markdown formatting for better readability.`

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json() as { transcript: string }

    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

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
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'done' })}\n\n`
              ))
            }

            // Handle errors
            if (message.type === 'result' && message.subtype !== 'success') {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'error', message: 'Analysis did not complete successfully' })}\n\n`
              ))
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: 'Stream error occurred' })}\n\n`
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
    console.error('Transcript analysis API error:', error)

    return new Response(
      JSON.stringify({ error: 'Failed to process transcript. Check server logs for details.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
