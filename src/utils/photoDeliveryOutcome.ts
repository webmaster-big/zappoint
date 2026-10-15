import type { PhotoDeliveryRecord, PhotoOutcomeTone, PhotoTextingState } from '../types/photo.types';

export const OUTCOME_TONE_BADGE: Record<PhotoOutcomeTone, string> = {
  success: 'bg-green-100 text-green-800',
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  muted: 'bg-gray-100 text-gray-600',
};

export const TEXTING_STATE_BADGE: Record<PhotoTextingState, { label: string; className: string }> = {
  verified: { label: 'confirmed working', className: 'bg-green-600 text-white' },
  unverified: { label: 'not confirmed yet', className: 'bg-amber-500 text-white' },
  failing: { label: 'not reaching phones', className: 'bg-red-600 text-white' },
  not_configured: { label: 'not sending', className: 'bg-amber-500 text-white' },
};

export const TEXTING_STATE_CARD: Record<PhotoTextingState, string> = {
  verified: 'border-green-200 bg-green-50/60',
  unverified: 'border-amber-200 bg-amber-50',
  failing: 'border-red-200 bg-red-50',
  not_configured: 'border-amber-200 bg-amber-50',
};

export const channelName = (delivery: Pick<PhotoDeliveryRecord, 'channel'>): string =>
  delivery.channel === 'email' ? 'Email' : 'Text message';

export const mergeDeliveries = (
  current: PhotoDeliveryRecord[],
  updates: PhotoDeliveryRecord[],
): PhotoDeliveryRecord[] => {
  const byId = new Map(updates.map((delivery) => [delivery.id, delivery]));
  return current.map((delivery) => {
    const update = byId.get(delivery.id);
    if (!update) return delivery;
    return { ...delivery, ...update, escape_room: update.escape_room ?? delivery.escape_room ?? null };
  });
};
