interface BookingWithSpaces {
  room_id?: number | null;
  room?: { id?: number | null; name?: string | null } | null;
  time_slots?: Array<{ room_id?: number | null; room?: { id?: number | null; name?: string | null } | null }> | null;
}

export interface BookingSpace {
  id: number | null;
  name: string;
}

export const bookingSpaces = (booking: BookingWithSpaces): BookingSpace[] => {
  const seen = new Set<string>();
  const spaces: BookingSpace[] = [];
  for (const slot of booking.time_slots ?? []) {
    const name = slot.room?.name?.trim();
    if (!name) continue;
    const id = slot.room_id ?? slot.room?.id ?? null;
    const key = id !== null ? `id:${id}` : `name:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    spaces.push({ id, name });
  }
  if (spaces.length > 0) return spaces;
  const fallback = booking.room?.name?.trim();
  return fallback ? [{ id: booking.room_id ?? booking.room?.id ?? null, name: fallback }] : [];
};

export const bookingSpaceNames = (booking: BookingWithSpaces): string =>
  bookingSpaces(booking).map(space => space.name).join(', ');
