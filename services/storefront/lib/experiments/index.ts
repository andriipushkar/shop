// Experiments module exports
export {
    ExperimentManager,
    experimentManager,
    useExperimentVariant,
    isFeatureEnabled,
    type Experiment as ExperimentConfig,
    type Variant as VariantConfig,
    type TargetAudience,
    type ExperimentContext,
    type ExperimentResult,
} from './ab-testing';

export {
    experiments,
    featureFlags,
    getAllExperiments,
    getExperimentById,
    getActiveExperiments,
} from './experiments-config';

export {
    ExperimentProvider,
    useExperiments,
    useExperiment,
    useFeatureFlag,
    Experiment,
    Variant,
    FeatureFlag,
} from './ExperimentProvider';
