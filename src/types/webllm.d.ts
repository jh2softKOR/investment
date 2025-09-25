export type WebLLMReport = {
  text?: string
  progress?: number
}

export type WebLLMChatMessage = {
  role: string
  content: string
}

export type WebLLMChatCompletionChunk = {
  choices?: Array<{
    delta?: {
      content?: string
    }
  }>
}

export type WebLLMEngine = {
  chat: {
    completions: {
      create: (input: {
        messages: WebLLMChatMessage[]
        temperature?: number
        max_tokens?: number
        stream?: boolean
      }) => AsyncIterable<WebLLMChatCompletionChunk>
    }
  }
  interruptGenerate?: () => void
  dispose?: () => void
}

export type WebLLM = {
  CreateMLCEngine: (
    model: { model_id: string },
    options?: { initProgressCallback?: (report: WebLLMReport) => void },
  ) => Promise<WebLLMEngine>
}

declare global {
  interface Window {
    webllm?: WebLLM
  }
}

export {}
