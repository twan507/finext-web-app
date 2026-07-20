// finext-nextjs/utils/dateUtils.ts

/**
 * Date utilities for handling timezone conversions between GMT+7 (Vietnam timezone) and UTC
 * 
 * Important notes:
 * - All dates entered by users are assumed to be in GMT+7 timezone
 * - All dates stored in database are in UTC format
 * - Date picker inputs (type="date") return strings in YYYY-MM-DD format
 * - These utilities ensure proper conversion between user input (GMT+7) and database storage (UTC)
 */

/**
 * Converts a date string (YYYY-MM-DD) from GMT+7 timezone to UTC
 * @param dateString - Date string in YYYY-MM-DD format (from date picker input)
 * @param isEndOfDay - If true, sets time to 23:59:59.999, otherwise 00:00:00.000
 * @returns UTC ISO string for database storage
 */
export function convertGMT7ToUTC(dateString: string, isEndOfDay: boolean = false): string {
    // Parse the date string as GMT+7
    // Note: Month is 0-indexed in JavaScript Date
    const [year, month, day] = dateString.split('-').map(Number);

    // Build the GMT+7 wall-clock instant as a UTC timestamp (Date.UTC is
    // timezone-independent), then subtract the 7h offset to get real UTC.
    // Using explicit UTC math keeps the result independent of the runtime's
    // local timezone.
    const gmt7Millis = isEndOfDay
        ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
        : Date.UTC(year, month - 1, day, 0, 0, 0, 0);

    const utcMillis = gmt7Millis - 7 * 60 * 60 * 1000;

    return new Date(utcMillis).toISOString();
}

/**
 * Converts a UTC ISO string to GMT+7 and returns date string (YYYY-MM-DD)
 * @param utcISOString - UTC ISO string
 * @returns Date string in YYYY-MM-DD format representing GMT+7 date
 */
export function convertUTCToGMT7DateString(utcISOString: string): string {
    const utcDate = new Date(utcISOString);

    // Add 7 hours to convert from UTC to GMT+7
    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));

    // Read with getUTC* so the formatted GMT+7 date is independent of the
    // runtime's local timezone.
    const year = gmt7Date.getUTCFullYear();
    const month = String(gmt7Date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(gmt7Date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Converts a UTC ISO string to GMT+7 formatted string for display
 * @param utcISOString - UTC ISO string
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string in GMT+7
 */
export function formatUTCToGMT7(utcISOString: string, includeTime: boolean = true): string {
    const utcDate = new Date(utcISOString);

    // Add 7 hours to convert from UTC to GMT+7
    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));

    // Read with getUTC* so the formatted GMT+7 output is independent of the
    // runtime's local timezone.
    const year = gmt7Date.getUTCFullYear();
    const month = String(gmt7Date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(gmt7Date.getUTCDate()).padStart(2, '0');

    if (!includeTime) {
        return `${day}/${month}/${year}`;
    }

    const hours = String(gmt7Date.getUTCHours()).padStart(2, '0');
    const minutes = String(gmt7Date.getUTCMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}
