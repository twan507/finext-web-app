// finext-nextjs/components/auth/features.ts
// Single source of truth cho feature keys và các preset list theo cấp bậc.
// Quy tắc: list cấp cao hơn BAO GỒM tất cả feature của cấp thấp hơn.

// ─────────────────────────────────────────
// Feature keys (khớp với DB)
// ─────────────────────────────────────────
export const FEATURES = {
    BASIC:    'basic_feature',
    ADVANCED: 'advanced_feature',
    PARTNER:  'broker_feature',
    MANAGER:  'manager_feature',
    ADMIN:    'admin_feature',
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

// ─────────────────────────────────────────
// Preset lists theo cấp bậc (cao → thấp)
// Mỗi cấp bao gồm tất cả cấp bên dưới.
// Dùng khi truyền vào requiredFeatures:
//   chỉ cần user có ÍT NHẤT 1 feature trong list là được xem.
// ─────────────────────────────────────────

/** Chỉ cần basic trở lên */
export const BASIC_AND_ABOVE: FeatureKey[] = [
    FEATURES.BASIC,
    FEATURES.ADVANCED,
    FEATURES.PARTNER,
    FEATURES.MANAGER,
    FEATURES.ADMIN,
];

/** Chỉ cần advanced trở lên */
export const ADVANCED_AND_ABOVE: FeatureKey[] = [
    FEATURES.ADVANCED,
    FEATURES.PARTNER,
    FEATURES.MANAGER,
    FEATURES.ADMIN,
];

/** Chỉ cần partner (broker) trở lên */
export const PARTNER_AND_ABOVE: FeatureKey[] = [
    FEATURES.PARTNER,
    FEATURES.MANAGER,
    FEATURES.ADMIN,
];

/** Chỉ cần manager trở lên */
export const MANAGER_AND_ABOVE: FeatureKey[] = [
    FEATURES.MANAGER,
    FEATURES.ADMIN,
];

/** Chỉ admin */
export const ADMIN_ONLY: FeatureKey[] = [
    FEATURES.ADMIN,
];
