import { defaultProjectSettings } from '../../../src/config/project-settings'

// @ts-expect-error nested recall settings should be deeply readonly
defaultProjectSettings.recall.defaultLimit = 20
