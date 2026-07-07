import type { Step } from 'react-joyride';

const row = (label: string, desc: string) => (
  <div style={{ marginBottom: 12, textAlign: 'left' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2563eb', flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{label}</span>
    </div>
    <div style={{ paddingLeft: 15, fontSize: 12, color: '#64748b', lineHeight: 1.55, textAlign: 'left' }}>{desc}</div>
  </div>
);

export const WAIVER_FORM_TOUR_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Form tour',
    content: 'This quick tour explains each section of the signing form. It takes about 90 seconds. Use Next / Back to move, or skip at any time.',
  },
  {
    target: '[data-tour="wf-legal-body"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Waiver Agreement text',
    content: 'This box contains the full legal text of the waiver. Scroll through and read it carefully before signing. The title and version number are shown at the top of the card.',
  },
  {
    target: '[data-tour="wf-adult-section"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Your Information',
    content: 'Fill in your personal details here. First and last name are required — they become part of the signed record. Email and phone are optional but let the venue send you a copy and reminders.',
  },
  {
    target: '[data-tour="wf-adult-names"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Your name',
    content: (
      <>
        <div>
          {row('First name', 'enter your legal first name exactly as on your ID')}
          {row('Last name', 'enter your legal last name exactly as on your ID')}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>Both fields are required.</p>
      </>
    ),
  },
  {
    target: '[data-tour="wf-adult-contact"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Email & phone',
    content: (
      <>
        <div>
          {row('Email', 'used to send a waiver confirmation and visit reminders')}
          {row('Phone', 'used to send SMS reminders if enabled by the venue')}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>Both are optional. Your contact info is never shared with third parties.</p>
      </>
    ),
  },
  {
    target: '[data-tour="wf-adult-dob"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Date of birth',
    content: 'Your date of birth is optional unless the venue requires it for age verification. Leave it blank if not marked required.',
  },
  {
    target: '[data-tour="wf-minors-section"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Adding minors (children)',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>If you\'re signing on behalf of children, add each one here.</p>
        <div>
          {row('+ Add Minor button', 'adds a new child entry row')}
          {row('Name fields', 'required for each child')}
          {row('Date of birth', 'required for each child if the waiver has age rules')}
          {row('Relationship', 'required if the waiver asks for it (e.g. Parent, Guardian)')}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>Each child is covered by this same waiver up to the template's max-minors limit.</p>
      </>
    ),
  },
  {
    target: '[data-tour="wf-consent-section"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Acknowledgment & Consent',
    content: 'This section contains any optional consent checkboxes (photo/video, marketing), your electronic signature field, and the final acceptance checkbox required to submit.',
  },
  {
    target: '[data-tour="wf-photo-consent"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Photo & video consent',
    content: 'Check this to allow the venue to use photos or videos taken during your visit for promotional materials. This is optional — leaving it unchecked does not affect your visit.',
  },
  {
    target: '[data-tour="wf-marketing-consent"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Marketing opt-in',
    content: 'Check this to receive future promotions, event announcements, and special offers from the venue. Always unchecked by default — the choice is entirely yours.',
  },
  {
    target: '[data-tour="wf-legal-name"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Electronic signature',
    content: 'Type your full legal name here — this is your electronic signature. It must match the name you entered in the "Your Information" section above. By typing it you confirm you are the person agreeing to this waiver.',
  },
  {
    target: '[data-tour="wf-electronic-consent"]',
    placement: 'top',
    disableBeacon: true,
    title: 'E-signature agreement',
    content: 'Check this to confirm that your typed name carries the same legal weight as a handwritten signature. Required on waivers that have electronic consent enabled.',
  },
  {
    target: '[data-tour="wf-agreement"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Final acceptance',
    content: 'Check this to confirm you have read, understood, and agreed to all the terms in this waiver. This checkbox is required — you cannot submit without it.',
  },
  {
    target: '[data-tour="wf-submit"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Sign & Submit',
    content: 'When every required field is filled and all required checkboxes are checked, click this button to submit. You\'ll see a confirmation screen immediately, and a copy can be emailed to you if you provided an address.',
  },
];
