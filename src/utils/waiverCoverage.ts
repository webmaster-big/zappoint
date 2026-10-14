export interface CoverageRow {
  status: string;
  minors?: ArrayLike<unknown> | null;
  checked_in_at?: string | null;
}

export interface WaiverCoverage {
  participants: number;
  forms: number;
  notSigned: number;
  minors: number;
  participantsCheckedIn: number;
}

export const peopleOnForm = (row: CoverageRow): number => (row.status === 'completed' ? 1 + (row.minors?.length ?? 0) : 0);

export const waiverCoverage = (rows: CoverageRow[]): WaiverCoverage =>
  rows.reduce<WaiverCoverage>(
    (totals, row) => {
      if (row.status === 'completed') {
        const people = peopleOnForm(row);
        totals.forms += 1;
        totals.participants += people;
        totals.minors += people - 1;
        if (row.checked_in_at) totals.participantsCheckedIn += people;
      } else if (row.status === 'pending') {
        totals.notSigned += 1;
      }
      return totals;
    },
    { participants: 0, forms: 0, notSigned: 0, minors: 0, participantsCheckedIn: 0 },
  );

export const countLabel = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

export const participantsCoveredLabel = (count: number): string => `${countLabel(count, 'participant', 'participants')} covered`;

export const formsSignedLabel = (count: number): string => `${countLabel(count, 'waiver form', 'waiver forms')} signed`;
