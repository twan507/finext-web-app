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
    const [year, month, day] = dateString.split('-').map(Number);

    // Create date object in GMT+7 (UTC+7)
    // Note: Month is 0-indexed in JavaScript Date
    const gmt7Date = new Date();
    gmt7Date.setFullYear(year, month - 1, day);

    if (isEndOfDay) {
        gmt7Date.setHours(23, 59, 59, 999);
    } else {
        gmt7Date.setHours(0, 0, 0, 0);
    }

    // Subtract 7 hours to convert from GMT+7 to UTC
    const utcDate = new Date(gmt7Date.getTime() - (7 * 60 * 60 * 1000));

    return utcDate.toISOString();
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

    // Format as YYYY-MM-DD
    const year = gmt7Date.getFullYear();
    const month = String(gmt7Date.getMonth() + 1).padStart(2, '0');
    const day = String(gmt7Date.getDate()).padStart(2, '0');

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

    const year = gmt7Date.getFullYear();
    const month = String(gmt7Date.getMonth() + 1).padStart(2, '0');
    const day = String(gmt7Date.getDate()).padStart(2, '0');

    if (!includeTime) {
        return `${day}/${month}/${year}`;
    }

    const hours = String(gmt7Date.getHours()).padStart(2, '0');
    const minutes = String(gmt7Date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}
