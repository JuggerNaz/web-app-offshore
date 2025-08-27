export interface ChangelogEntry {
  id: string;
  title: string;
  content: string;
  metadata: {
    date?: string;
    type?: string;
    status?: string;
    version?: string;
  };
  filename: string;
  order: number;
}

/**
 * Determines the update type badge color based on the type
 */
export function getUpdateTypeColor(type?: string): string {
  if (!type) return 'bg-gray-100 text-gray-800';
  
  switch (type.toLowerCase()) {
    case 'feature':
    case 'feature implementation':
      return 'bg-green-100 text-green-800';
    case 'security':
    case 'security update':
      return 'bg-red-100 text-red-800';
    case 'enhancement':
    case 'improvement':
      return 'bg-blue-100 text-blue-800';
    case 'maintenance':
    case 'bug fix':
    case 'fix':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Formats a date string for display
 */
export function formatChangelogDate(dateString?: string): string {
  if (!dateString) return 'Date not specified';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
}
