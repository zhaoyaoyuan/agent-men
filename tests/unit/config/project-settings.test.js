import { describe, expect, it } from 'vitest';
import { defaultProjectSettings } from '../../../src/config/project-settings';
describe('defaultProjectSettings', () => {
    it('should expose recall defaults', () => {
        expect(defaultProjectSettings).toEqual({
            recall: {
                defaultLimit: 10,
                minScoreThreshold: 0.2,
                includeExplanationByDefault: true,
                includeEvidenceByDefault: false,
                includeDocumentsByDefault: true,
            },
        });
    });
    it('should reject runtime mutations of shared defaults', () => {
        expect(() => {
            ;
            defaultProjectSettings.recall.defaultLimit = 20;
        }).toThrow(TypeError);
    });
});
