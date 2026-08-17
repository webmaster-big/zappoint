/**
 * Venue records are named "City | Brand", so the half people recognise is the first one.
 * Both the chooser cards and the map labels read a location's name through here, so they
 * cannot drift apart if the naming convention changes.
 */
export interface LocationNameParts {
  primary: string;
  secondary: string | null;
}

export const splitLocationName = (name: string, city?: string | null): LocationNameParts => {
  const parts = name.split('|').map((part) => part.trim()).filter(Boolean);

  if (parts.length > 1) {
    return { primary: parts[0], secondary: parts.slice(1).join(' · ') };
  }

  const primary = parts[0] || name;

  return {
    primary,
    secondary: city && city !== primary ? city : null,
  };
};

export const locationShortName = (name: string, city?: string | null): string =>
  splitLocationName(name, city).primary;
