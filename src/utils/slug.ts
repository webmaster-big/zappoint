export function generateSlug(name: string, id: number | string): string {
  const slugName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  return `${slugName}-${id}`;
}

export const createSlugWithId = generateSlug;

export function extractIdFromSlug(slug: string): number {
  const parts = slug.split('-');
  const id = parts[parts.length - 1];
  return parseInt(id, 10);
}

export function generateLocationSlug(location: string): string {
  return location
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
