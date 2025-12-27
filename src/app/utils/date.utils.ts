/**
 * Utility functions for date formatting
 */

/**
 * Formats a date string to a user-friendly format
 * @param dateString - ISO date string (e.g., "2025-08-01T00:00:00")
 * @param format - Format type: 'short', 'medium', 'long', or 'custom'
 * @returns Formatted date string
 */
export function formatExpirationDate(dateString: string, format: 'short' | 'medium' | 'long' | 'custom' = 'short'): string {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original if invalid
    }

    switch (format) {
      case 'short':
        // e.g., "Aug 1, 2025"
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      
      case 'medium':
        // e.g., "August 1, 2025"
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      
      case 'long':
        // e.g., "Friday, August 1, 2025"
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      
      case 'custom':
        // e.g., "08/01/2025"
        return date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        });
      
      default:
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original if error occurs
  }
}

/**
 * Gets the relative time description (e.g., "in 2 days", "yesterday")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export function getRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays === -1) {
      return 'Yesterday';
    } else if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`;
    }
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return '';
  }
}

/**
 * Checks if a date is in the past
 * @param dateString - ISO date string
 * @returns True if date is in the past
 */
export function isExpired(dateString: string): boolean {
  try {
    const date = new Date(dateString);
    const now = new Date();
    return date < now;
  } catch (error) {
    console.error('Error checking if date is expired:', error);
    return false;
  }
} 