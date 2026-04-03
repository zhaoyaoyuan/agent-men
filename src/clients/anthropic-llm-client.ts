import Anthropic from '@anthropic-ai/sdk'
import type { LLMClient, ExtractedMemory } from '../services/extract-memories-service'

const VALID_MEMORY_TYPES = new Set([
  'fact',
  'constraint',
  'preference',
  'task_state',
  'experience'
])

const SYSTEM_PROMPT = `You are a memory extraction assistant. Your task is to extract structured memories from the given user event content.

Extract memories into the following JSON format:
- Output must be a JSON array of memory objects
- Each memory must have:
  * memoryType: must be one of: "fact", "constraint", "preference", "task_state", "experience"
  * title: a short, clear title (5-10 words) summarizing the memory
  * content: a detailed, complete description of the memory

Guidelines:
- Extract only meaningful, lasting information worth remembering
- Ignore transient, irrelevant, or obvious information
- Combine related information into a single memory when appropriate
- Be specific and precise
- If there are no memories to extract, output an empty array

Respond ONLY with valid JSON. Do not include any explanations, markdown, or extra text.`

interface AnthropicLLMClientConfig {
  apiKey?: string
  baseURL?: string
  modelName: string
  maxTokens?: number
  temperature?: number
}

export class AnthropicLLMClient implements LLMClient {
  private client: Anthropic
  private modelName: string
  private maxTokens: number
  private temperature: number

  constructor(config: AnthropicLLMClientConfig) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }

    const clientConfig: ConstructorParameters<typeof Anthropic>[0] = {
      apiKey
    }

    if (config.baseURL) {
      clientConfig.baseURL = config.baseURL
    }

    this.client = new Anthropic(clientConfig)
    this.modelName = config.modelName
    this.maxTokens = config.maxTokens ?? 1024
    this.temperature = config.temperature ?? 0.0
  }

  async extractMemoriesFromEvent(eventContent: string): Promise<ExtractedMemory[]> {
    try {
      const response = await this.client.messages.create({
        model: this.modelName,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: eventContent
          }
        ]
      })

      // Extract text content from response
      const textContent = this.extractTextContent(response)
      if (!textContent) {
        throw new Error('No content in Anthropic response')
      }

      // Clean and parse JSON
      const cleanedContent = this.cleanJsonResponse(textContent)
      const parsed = JSON.parse(cleanedContent)

      if (!Array.isArray(parsed)) {
        throw new Error('Expected array response from LLM')
      }

      // Validate and filter items
      return this.validateAndFilter(parsed)
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Anthropic API call failed: ${error.message}`)
      }
      throw new Error('Anthropic API call failed with unknown error')
    }
  }

  private extractTextContent(response: Anthropic.Messages.Message): string | null {
    for (const block of response.content) {
      if (block.type === 'text') {
        return block.text
      }
    }
    return null
  }

  private cleanJsonResponse(text: string): string {
    // Remove markdown code block markers if present
    let cleaned = text.trim()
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '')
    cleaned = cleaned.replace(/\s*```$/, '')
    return cleaned.trim()
  }

  private validateAndFilter(parsed: unknown[]): ExtractedMemory[] {
    const result: ExtractedMemory[] = []

    for (const item of parsed) {
      if (this.isValidExtractedMemory(item)) {
        result.push(item)
      }
    }

    return result
  }

  private isValidExtractedMemory(item: unknown): item is ExtractedMemory {
    if (typeof item !== 'object' || item === null) {
      return false
    }

    const { memoryType, title, content } = item as Record<string, unknown>

    if (
      typeof memoryType !== 'string' ||
      !VALID_MEMORY_TYPES.has(memoryType as any)
    ) {
      return false
    }

    if (typeof title !== 'string' || title.trim().length === 0) {
      return false
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      return false
    }

    return true
  }
}
