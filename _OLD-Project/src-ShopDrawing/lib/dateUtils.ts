import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const THAILAND_TIMEZONE = "Asia/Bangkok";

/**
 * Format a date/timestamp to Thailand timezone (GMT+7)
 * @param date - Date string, Date object, or timestamp
 * @param formatStr - date-fns format string (default: "dd-MM-yy'/'HH:mm")
 * @returns Formatted date string in Thailand timezone
 */
export const formatThailandTime = (
  date: string | Date | number,
  formatStr: string = "dd-MM-yy'/'HH:mm"
): string => {
  const dateObj = typeof date === "string" || typeof date === "number" 
    ? new Date(date) 
    : date;
  
  return format(toZonedTime(dateObj, THAILAND_TIMEZONE), formatStr);
};
