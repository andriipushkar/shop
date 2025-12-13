/**
 * A/B Testing Service Unit Tests
 */

import { ABTestingService, resetABTestingService } from '@/lib/ab-testing/ab-service';
import { Experiment, ExperimentStatus, Variant } from '@/lib/ab-testing';

// Mock fetch
global.fetch = jest.fn();

describe('ABTestingService', () => {
  let service: ABTestingService;

  beforeEach(() => {
    // Clear mocks first
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockReset();

    // Reset singleton
    resetABTestingService();

    // Create new instance for each test
    service = new ABTestingService({
      storageKey: 'test_ab_experiments',
      apiEndpoint: '/api/ab',
      autoTrackExposure: false,
      significanceThreshold: 95,
      minSampleSize: 100,
    });

    // Mock localStorage
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should load active experiments on initialization', async () => {
      const mockExperiments: Experiment[] = [
        createMockExperiment('exp1', 'running'),
        createMockExperiment('exp2', 'running'),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExperiments,
      });

      await service.initialize();

      const experiments = service.getExperiments();
      expect(experiments).toHaveLength(2);
    });
  });

  describe('Variant Assignment', () => {
    beforeEach(async () => {
      const mockExperiment = createMockExperiment('test-exp', 'running');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockExperiment],
      });

      await service.initialize('user123');
    });

    it('should assign a variant consistently for the same user', () => {
      const variant1 = service.getVariant('test-exp');
      const variant2 = service.getVariant('test-exp');

      expect(variant1).toBeTruthy();
      expect(variant2).toBeTruthy();
      expect(variant1?.id).toBe(variant2?.id);
    });

    it('should return null for non-running experiments', async () => {
      const pausedExperiment = createMockExperiment('paused-exp', 'paused');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [pausedExperiment],
      });

      await service.initialize();

      const variant = service.getVariant('paused-exp');
      expect(variant).toBeNull();
    });

    it('should store assignment in localStorage', () => {
      service.getVariant('test-exp');

      expect(Storage.prototype.setItem).toHaveBeenCalled();
    });

    it('should return variant config', () => {
      const config = service.getVariantConfig('test-exp');
      expect(config).toBeTruthy();
    });

    it('should check if user is in experiment', () => {
      const isIn = service.isInExperiment('test-exp');
      expect(typeof isIn).toBe('boolean');
    });
  });

  describe('Experiment Creation', () => {
    it('should create a valid experiment', async () => {
      const newExperiment = {
        name: 'Test Experiment',
        description: 'Test description',
        status: 'draft' as ExperimentStatus,
        type: 'ab_test' as const,
        variants: [
          {
            id: 'control',
            name: 'Control',
            weight: 50,
            isControl: true,
            config: {},
          },
          {
            id: 'variant_a',
            name: 'Variant A',
            weight: 50,
            isControl: false,
            config: {},
          },
        ],
        targeting: {},
        metrics: [],
        allocation: 100,
        createdBy: 'test-user',
      };

      const createdExperiment = { ...newExperiment, id: 'new-exp-id', createdAt: new Date(), updatedAt: new Date() };

      // Mock the create experiment call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => createdExperiment,
      });

      const created = await service.createExperiment(newExperiment);

      expect(created).toBeTruthy();
      expect(created?.name).toBe('Test Experiment');
    });

    it('should reject experiments with invalid weights', async () => {
      const invalidExperiment = {
        name: 'Invalid Experiment',
        description: 'Test',
        status: 'draft' as ExperimentStatus,
        type: 'ab_test' as const,
        variants: [
          {
            id: 'control',
            name: 'Control',
            weight: 60,
            isControl: true,
            config: {},
          },
          {
            id: 'variant_a',
            name: 'Variant A',
            weight: 50,
            isControl: false,
            config: {},
          },
        ],
        targeting: {},
        metrics: [],
        allocation: 100,
        createdBy: 'test-user',
      };

      await expect(service.createExperiment(invalidExperiment)).rejects.toThrow();
    });

    it('should reject experiments with no control variant', async () => {
      const invalidExperiment = {
        name: 'Invalid Experiment',
        description: 'Test',
        status: 'draft' as ExperimentStatus,
        type: 'ab_test' as const,
        variants: [
          {
            id: 'variant_a',
            name: 'Variant A',
            weight: 50,
            isControl: false,
            config: {},
          },
          {
            id: 'variant_b',
            name: 'Variant B',
            weight: 50,
            isControl: false,
            config: {},
          },
        ],
        targeting: {},
        metrics: [],
        allocation: 100,
        createdBy: 'test-user',
      };

      await expect(service.createExperiment(invalidExperiment)).rejects.toThrow();
    });
  });

  describe('Conversion Tracking', () => {
    beforeEach(async () => {
      const mockExperiment = createMockExperiment('test-exp', 'running');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockExperiment],
      });

      await service.initialize('user123');

      // Assign variant (this triggers exposure tracking internally)
      service.getVariant('test-exp');
    });

    it('should track conversion events', async () => {
      // Clear mock calls from initialization and variant assignment
      (global.fetch as jest.Mock).mockClear();

      // Mock for sendTrackingEvent
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Mock for getResults in checkAutoDisable
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalParticipants: 50 }), // Below min sample size
      });

      await service.trackConversion('test-exp', 'conversion', 100);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/track'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should not track conversions for unassigned experiments', async () => {
      // Clear mock calls from beforeEach initialization
      (global.fetch as jest.Mock).mockClear();

      await service.trackConversion('non-existent-exp', 'conversion');

      // Should not call fetch since user is not in experiment
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Statistical Calculations', () => {
    it('should calculate statistical significance', () => {
      const significance = service.calculateSignificance(
        100, // control conversions
        1000, // control participants
        120, // variant conversions
        1000 // variant participants
      );

      expect(significance).toBeGreaterThan(0);
      expect(significance).toBeLessThanOrEqual(100);
    });

    it('should return 0 significance for insufficient data', () => {
      const significance = service.calculateSignificance(
        1, // control conversions
        1, // control participants
        1, // variant conversions
        1 // variant participants
      );

      expect(significance).toBe(0);
    });
  });

  describe('Experiment Management', () => {
    beforeEach(async () => {
      const mockExperiment = createMockExperiment('test-exp', 'running');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockExperiment],
      });

      await service.initialize();
    });

    it('should get experiment by ID', () => {
      const experiment = service.getExperiment('test-exp');
      expect(experiment).toBeTruthy();
      expect(experiment?.id).toBe('test-exp');
    });

    it('should get all experiments', () => {
      const experiments = service.getExperiments();
      expect(Array.isArray(experiments)).toBe(true);
    });

    it('should stop an experiment', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...createMockExperiment('test-exp', 'paused') }),
      });

      await service.stopExperiment('test-exp');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/experiments/test-exp'),
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should declare a winner', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...createMockExperiment('test-exp', 'completed'),
          winner: 'variant_a',
        }),
      });

      await service.declareWinner('test-exp', 'variant_a');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/experiments/test-exp'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('variant_a'),
        })
      );
    });
  });

  describe('Assignment Clearing', () => {
    it('should clear all assignments', () => {
      service.clearAssignments();

      expect(Storage.prototype.removeItem).toHaveBeenCalled();
    });
  });
});

// ==================== HELPER FUNCTIONS ====================

function createMockExperiment(id: string, status: ExperimentStatus): Experiment {
  return {
    id,
    name: `Test Experiment ${id}`,
    description: 'Test experiment description',
    status,
    type: 'ab_test',
    variants: [
      {
        id: 'control',
        name: 'Control',
        description: 'Control variant',
        weight: 50,
        isControl: true,
        config: { text: 'Control' },
      },
      {
        id: 'variant_a',
        name: 'Variant A',
        description: 'Test variant A',
        weight: 50,
        isControl: false,
        config: { text: 'Variant A' },
      },
    ],
    targeting: {},
    metrics: [
      { id: 'conversion', name: 'Conversion', type: 'conversion', isPrimary: true },
    ],
    allocation: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-user',
  };
}
