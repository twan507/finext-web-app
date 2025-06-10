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
