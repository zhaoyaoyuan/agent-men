import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicLLMClient } from '../../../src/clients/anthropic-llm-client'
import Anthropic from '@anthropic-ai/sdk'

// Mock the Anthropic SDK
const mockMessagesCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  const mockAnthropic = vi.fn(() => ({
    messages: {
      create: mockMessagesCreate
    }
  })) as any

  return {
    default: mockAnthropic,
    Anthropic: mockAnthropic
  }
})

describe('AnthropicLLMClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear environment
    delete process.env.ANTHROPIC_API_KEY
  })

  it('throws error when API key is not provided', () => {
    expect(() => new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' }))
      .toThrow('ANTHROPIC_API_KEY environment variable is required')
  })

  it('initializes successfully with API key from environment', () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key'
    expect(() => new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' }))
      .not.toThrow()
  })

  it('initializes successfully with explicit API key', () => {
    expect(() => new AnthropicLLMClient({
      apiKey: 'explicit-api-key',
      modelName: 'claude-3-sonnet-20240229'
    })).not.toThrow()
  })

  it('extracts memories correctly from valid JSON response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key'

    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: `[
          {
            "memoryType": "fact",
            "title": "User birthday",
            "content": "The user's birthday is on January 15th."
          },
          {
            "memoryType": "preference",
            "title": "Coffee preference",
            "content": "User prefers black coffee without sugar."
          }
        ]`
      }]
    } as any)

    const client = new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' })
    const result = await client.extractMemoriesFromEvent(
      'My birthday is January 15th. I always drink black coffee without sugar.'
    )

    expect(result).toEqual([
      {
        memoryType: 'fact',
        title: 'User birthday',
        content: 'The user\'s birthday is on January 15th.'
      },
      {
        memoryType: 'preference',
        title: 'Coffee preference',
        content: 'User prefers black coffee without sugar.'
      }
    ])
    expect(mockMessagesCreate).toHaveBeenCalled()
  })

  it('returns empty array when LLM returns empty array', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key'

    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '[]'
      }]
    } as any)

    const client = new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' })
    const result = await client.extractMemoriesFromEvent('Nothing memorable here.')

    expect(result).toEqual([])
  })

  it('throws error when API call fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key'

    mockMessagesCreate.mockRejectedValue(new Error('API rate limit exceeded'))

    const client = new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' })

    await expect(client.extractMemoriesFromEvent('Test content'))
      .rejects.toThrow('Anthropic API call failed: API rate limit exceeded')
  })

  it('throws error when response has no text content', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key'

    mockMessagesCreate.mockResolvedValue({
      content: []
    } as any)

    const client = new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' })

    await expect(client.extractMemoriesFromEvent('Test content'))
      .rejects.toThrow('No content in Anthropic response')
  })

  it('throws error when JSON parsing fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key'

    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: 'This is not valid JSON'
      }]
    } as any)

    const client = new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' })

    await expect(client.extractMemoriesFromEvent('Test content'))
      .rejects.toThrow(/Anthropic API call failed:.*Unexpected token/)
  })

  it('filters out invalid memory types and returns only valid ones', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key'

    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: `[
          {
            "memoryType": "fact",
            "title": "Valid fact",
            "content": "This is a valid fact."
          },
          {
            "memoryType": "invalid_type",
            "title": "Bad type",
            "content": "This has an invalid memory type."
          },
          {
            "memoryType": "preference",
            "title": "Valid preference",
            "content": "This is a valid preference."
          }
        ]`
      }]
    } as any)

    const client = new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' })
    const result = await client.extractMemoriesFromEvent('Test content with mixed types')

    // Only the valid ones should be returned
    expect(result).toHaveLength(2)
    expect(result.map(m => m.memoryType)).toEqual(['fact', 'preference'])
  })

  it('strips markdown code block wrapping from response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key'

    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '```json\n[{"memoryType": "fact", "title": "Test", "content": "A test fact."}]\n```'
      }]
    } as any)

    const client = new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' })
    const result = await client.extractMemoriesFromEvent('Test content')

    expect(result).toEqual([{
      memoryType: 'fact',
      title: 'Test',
      content: 'A test fact.'
    }])
  })

  it('handles missing required fields by filtering them out', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key'

    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: `[
          {
            "memoryType": "fact",
            "content": "Missing title field here."
          },
          {
            "memoryType": "fact",
            "title": "Missing content field."
          },
          {
            "title": "Missing memoryType.",
            "content": "No type here."
          },
          {
            "memoryType": "fact",
            "title": "Complete item",
            "content": "This one has all fields."
          }
        ]`
      }]
    } as any)

    const client = new AnthropicLLMClient({ modelName: 'claude-3-sonnet-20240229' })
    const result = await client.extractMemoriesFromEvent('Test content')

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Complete item')
  })
})
