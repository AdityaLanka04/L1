/**
 * Format a date/time string to the user's local timezone
 * @param {string} dateString - ISO date string from backend (UTC)
 * @param {boolean} includeTime - Whether to include time in output
 * @returns {string} Formatted date string in user's local timezone
 */
export const formatToLocalTime = (dateString, includeTime = true) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  if (includeTime) {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } else {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
};

/**
 * Get relative time (e.g., "2 hours ago", "just now")
 * @param {string} dateString - ISO date string from backend (UTC)
 * @returns {string} Relative time string
 */
export const getRelativeTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  
  return formatToLocalTime(dateString, false);
};

/**
 * Format time only (e.g., "2:30 PM")
 * @param {string} dateString - ISO date string from backend (UTC)
 * @returns {string} Formatted time string
 */
export const formatTimeOnly = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};
