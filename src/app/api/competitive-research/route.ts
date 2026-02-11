import { query } from '@anthropic-ai/claude-agent-sdk'

const SYSTEM_PROMPT = `You are a specialized Competitive Research Agent for Sentry.

Your role is to:
- Research and analyze Sentry's competitors in the application monitoring and error tracking space
- Compare Sentry's features, pricing, and capabilities against competitors like Datadog, New Relic, Rollbar, Bugsnag, AppDynamics, Dynatrace, and others
- Provide factual, up-to-date information about market positioning
- Search the web for recent comparisons, reviews, and competitive intelligence
- Analyze strengths and weaknesses objectively
- Highlight Sentry's unique value propositions and differentiators

Key competitors to be aware of:
- **Datadog**: Full-stack observability platform (APM, logs, infrastructure)
- **New Relic**: Application performance monitoring and observability
- **Rollbar**: Error tracking and monitoring
- **Bugsnag**: Error monitoring for mobile and web apps
- **AppDynamics**: Application performance management
- **Dynatrace**: Software intelligence platform
- **Splunk**: Log management and analytics
- **LogRocket**: Session replay and error tracking

Guidelines:
- Always use WebSearch for current pricing, features, and market information
- Be objective and factual - acknowledge where competitors may have advantages
- Focus on technical capabilities, not just marketing claims
- Cite sources when providing specific information
- Provide actionable insights for sales, marketing, and product teams
- Keep responses well-structured with clear sections and comparisons

When comparing, consider these dimensions:
- Error tracking and debugging capabilities
- Performance monitoring (APM)
- Session replay features
- Pricing models (developer-friendly vs enterprise)
- SDK and platform support
- Integration ecosystem
- Data privacy and compliance
- Developer experience and ease of setup
- Community and support`

interface MessageInput {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: Request) {
  try {
    const { messages, model } = await request.json() as {
      messages: MessageInput[]
      model?: string
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({ error: 'No user message found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Build conversation context
    const conversationContext = messages
      .slice(0, -1)
      .map((m: MessageInput) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const fullPrompt = conversationContext
      ? `${SYSTEM_PROMPT}\n\nPrevious conversation:\n${conversationContext}\n\nUser: ${lastUserMessage.content}`
      : `${SYSTEM_PROMPT}\n\nUser: ${lastUserMessage.content}`

    // Create a streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Use the claude-agent-sdk query function with web search enabled
          for await (const message of query({
            prompt: fullPrompt,
            options: {
              maxTurns: 15, // More turns for thorough research
              model: model || 'claude-sonnet-4-5-20250929',
              tools: { type: 'preset', preset: 'claude_code' },
              permissionMode: 'bypassPermissions',
              allowDangerouslySkipPermissions: true,
              includePartialMessages: true,
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

            // Send tool start events from assistant messages
            if (message.type === 'assistant' && 'message' in message) {
              const content = message.message?.content
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'tool_use') {
                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({ type: 'tool_start', tool: block.name })}\n\n`
                    ))
                  }
                }
              }
            }

            // Send tool progress updates
            if (message.type === 'tool_progress') {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'tool_progress', tool: message.tool_name, elapsed: message.elapsed_time_seconds })}\n\n`
              ))
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
                `data: ${JSON.stringify({ type: 'error', message: 'Research query did not complete successfully' })}\n\n`
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
    console.error('Competitive research API error:', error)

    return new Response(
      JSON.stringify({ error: 'Failed to process research request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
