// utils/systemLicenses.ts

/**
 * Get the list of system license keys that should not be available for creating new subscriptions or transactions
 */
export const getSystemLicenseKeys = (): string[] => {
    const systemLicenseKeysEnv = process.env.NEXT_PUBLIC_SYSTEM_LICENSE_KEYS;

    if (!systemLicenseKeysEnv) {
        throw new Error('NEXT_PUBLIC_SYSTEM_LICENSE_KEYS environment variable is not defined. Please check your .env configuration.');
    }

    return systemLicenseKeysEnv.split(',').map(key => key.trim().toUpperCase());
};

/**
 * Check if a license key is a system license that should be restricted
 */
export const isSystemLicense = (licenseKey: string): boolean => {
    const systemLicenseKeys = getSystemLicenseKeys();
    return systemLicenseKeys.includes(licenseKey.toUpperCase());
};

/**
 * Filter out system licenses from a list of licenses
 */
export const filterNonSystemLicenses = <T extends { key: string }>(licenses: T[]): T[] => {
    const systemLicenseKeys = getSystemLicenseKeys();
    return licenses.filter(license => !systemLicenseKeys.includes(license.key.toUpperCase()));
};

// === FEATURE UTILITIES ===

/**
 * Get the list of basic features that should always be selected and cannot be deselected
 */
export const getBasicFeatures = (): string[] => {
    const basicFeaturesEnv = process.env.NEXT_PUBLIC_BASIC_FEATURES;

    if (!basicFeaturesEnv) {
        console.warn('NEXT_PUBLIC_BASIC_FEATURES environment variable is not defined. No basic features will be enforced.');
        return [];
    }

    return basicFeaturesEnv.split(',').map(key => key.trim());
};

/**
 * Get the list of system features that should not be selectable by users
 */
export const getSystemFeatures = (): string[] => {
    const systemFeaturesEnv = process.env.NEXT_PUBLIC_SYSTEM_FEATURES;

    if (!systemFeaturesEnv) {
        console.warn('NEXT_PUBLIC_SYSTEM_FEATURES environment variable is not defined. No system features will be restricted.');
        return [];
    }

    return systemFeaturesEnv.split(',').map(key => key.trim());
};

/**
 * Check if a feature key is a basic feature that should always be selected
 */
export const isBasicFeature = (featureKey: string): boolean => {
    const basicFeatures = getBasicFeatures();
    return basicFeatures.includes(featureKey);
};

/**
 * Check if a feature key is a system feature that should not be selectable
 */
export const isSystemFeature = (featureKey: string): boolean => {
    const systemFeatures = getSystemFeatures();
    return systemFeatures.includes(featureKey);
};

/**
 * Filter out system features from a list of features (features that should not be selectable)
 */
export const filterSelectableFeatures = <T extends { key: string }>(features: T[]): T[] => {
    const systemFeatures = getSystemFeatures();
    return features.filter(feature => !systemFeatures.includes(feature.key));
};

/**
 * Get basic features from a list of features
 */
export const getBasicFeaturesFromList = <T extends { key: string }>(features: T[]): T[] => {
    const basicFeatures = getBasicFeatures();
    return features.filter(feature => basicFeatures.includes(feature.key));
};

/**
 * Ensure basic features are always included in the selected features list
 */
export const ensureBasicFeaturesIncluded = <T extends { key: string }>(
    selectedFeatures: T[],
    allFeatures: T[]
): T[] => {
    const basicFeatures = getBasicFeaturesFromList(allFeatures);
    const selectedKeys = selectedFeatures.map(f => f.key);

    // Add basic features that are not already selected
    const missingBasicFeatures = basicFeatures.filter(
        basicFeature => !selectedKeys.includes(basicFeature.key)
    );

    return [...selectedFeatures, ...missingBasicFeatures];
};

/**
 * Get feature keys ensuring basic features are always included
 */
export const getFeatureKeysWithBasics = (selectedFeatureKeys: string[]): string[] => {
    const basicFeatures = getBasicFeatures();
    const uniqueKeys = new Set([...basicFeatures, ...selectedFeatureKeys]);
    return Array.from(uniqueKeys);
};
