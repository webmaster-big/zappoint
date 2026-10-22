import type { PhotoRecipientMatch, PhotoRegistrationMatch } from '../types/photo.types';

export const recipientKey = (row: Pick<PhotoRecipientMatch, 'kind' | 'id'>): string => `${row.kind}:${row.id}`;

export const isRegistration = (row: PhotoRecipientMatch): row is PhotoRegistrationMatch => row.kind === 'registration';

export const receivesSomething = (row: PhotoRecipientMatch, textRegistrants: boolean): boolean =>
  isRegistration(row) ? row.contactable && (row.can_email || (textRegistrants && row.can_text)) : row.contactable;

export const receivingCount = (selected: PhotoRecipientMatch[], textRegistrants: boolean): number =>
  selected.filter((row) => receivesSomething(row, textRegistrants)).length;

export const recipientIds = (
  selected: PhotoRecipientMatch[],
  textRegistrants: boolean,
): { waiver_ids: number[]; registration_entry_ids?: number[]; text_registrants?: boolean } => {
  const registrationIds = selected.filter(isRegistration).map((row) => row.id);
  return {
    waiver_ids: selected.filter((row) => !isRegistration(row)).map((row) => row.id),
    ...(registrationIds.length > 0 ? { registration_entry_ids: registrationIds, text_registrants: textRegistrants } : {}),
  };
};
