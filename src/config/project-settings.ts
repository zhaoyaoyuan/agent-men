type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]
}

export interface ProjectSettings {
  recall: {
    defaultLimit: number
    minScoreThreshold: number
    includeExplanationByDefault: boolean
    includeEvidenceByDefault: boolean
    includeDocumentsByDefault: boolean
  }
}

export const defaultProjectSettings: DeepReadonly<ProjectSettings> = Object.freeze({
  recall: Object.freeze({
    defaultLimit: 10,
    minScoreThreshold: 0.2,
    includeExplanationByDefault: true,
    includeEvidenceByDefault: false,
    includeDocumentsByDefault: true,
  }),
})
