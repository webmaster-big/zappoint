import type { Step } from 'react-joyride';

export const WAIVER_FORM_TOUR_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Form Tour',
    content: 'This quick tour explains each section of the waiver. It takes about 90 seconds. Use the arrows to move through it — or skip at any time.',
  },

  {
    target: '[data-tour="wf-legal-body"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Agreement text',
    content: 'This box contains the full legal text of the waiver. Scroll through it and read it carefully before you sign. The title and version number are shown at the top of the card.',
  },

  {
    target: '[data-tour="wf-adult-section"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Your Information',
    content: 'Fill in your personal details here. First name and last name are required — they become part of the signed record. Email and phone are optional but let us send you a copy and any visit reminders.',
  },

  {
    target: '[data-tour="wf-adult-names"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Your name',
    content: 'Enter your legal first and last name exactly as they appear on your ID. These fields are required.',
  },

  {
    target: '[data-tour="wf-adult-contact"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Email & phone',
    content: 'Both are optional, but entering at least one lets the venue send you a waiver confirmation and visit reminders. Your contact info is never shared with third parties.',
  },

  {
    target: '[data-tour="wf-adult-dob"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Date of birth',
    content: 'Your date of birth is optional unless the venue requires it for age verification. Leave it blank if it isn\'t marked required.',
  },

  {
    target: '[data-tour="wf-minors-section"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Adding minors',
    content: 'If you\'re signing on behalf of children, this is where you add them. Click "+ Add Minor" for each child and fill in their name and date of birth. You can add up to the limit shown. Each child is covered by this same waiver.',
  },

  {
    target: '[data-tour="wf-consent-section"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Acknowledgment & Consent',
    content: 'This section contains any optional consent checkboxes (photo/video, marketing) as well as your electronic signature and the required acceptance of the waiver terms.',
  },

  {
    target: '[data-tour="wf-photo-consent"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Photo & video consent',
    content: 'Check this if you consent to photos or videos taken during your visit being used for promotional materials. This is optional — unchecking it does not affect your visit.',
  },

  {
    target: '[data-tour="wf-marketing-consent"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Marketing opt-in',
    content: 'Opt in to receive future promotions, event announcements, and special offers from the venue. This is always unchecked by default — the choice is entirely yours.',
  },

  {
    target: '[data-tour="wf-legal-name"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Electronic signature',
    content: 'Type your full legal name here — this is your electronic signature. It must match the name you entered in "Your Information" above. By typing it, you confirm you are the person agreeing to this waiver.',
  },

  {
    target: '[data-tour="wf-electronic-consent"]',
    placement: 'top',
    disableBeacon: true,
    title: 'E-signature agreement',
    content: 'Check this to confirm that your typed name has the same legal weight as a handwritten signature. This is required on waivers that have electronic consent enabled.',
  },

  {
    target: '[data-tour="wf-agreement"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Final acceptance',
    content: 'Check this box to confirm you have read, understood, and agreed to all the terms in this waiver. This is required — you cannot submit without it.',
  },

  {
    target: '[data-tour="wf-submit"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Sign & Submit',
    content: 'When every required field is filled and the checkboxes are checked, click this button to submit. You\'ll see a confirmation screen immediately, and a copy can be sent to your email if you provided one.',
  },
];
