/**
 * Generate a URL-friendly slug from a name and ID
 * Format: "name-in-lowercase-id"
 * Example: "Laser Tag Adventure" + 123 => "laser-tag-adventure-123"
 */
export function generateSlug(name: string, id: number | string): string {
  const slugName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  return `${slugName}-${id}`;
}

/**
 * Alias for generateSlug for backward compatibility
 */
export const createSlugWithId = generateSlug;

/**
 * Extract the ID from a slug
 * Format: "name-in-lowercase-id" => id
 * Example: "laser-tag-adventure-123" => 123
 */
export function extractIdFromSlug(slug: string): number {
  const parts = slug.split('-');
  const id = parts[parts.length - 1];
  return parseInt(id, 10);
}

/**
 * Generate a location slug from location name
 * Format: "Location Name" => "location-name"
 */
export function generateLocationSlug(location: string): string {
  return location
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
