import type { Step } from 'react-joyride';

// ── Waiver Records  (/waivers) ─────────────────────────────────────────────

export const WAIVER_RECORDS_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Records tour',
    content: 'This tour walks you through every feature on the Waiver Records page. Use the arrows to move at your own pace, or skip at any time.',
  },
  {
    target: '[data-tour="waivers-sidebar"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Waivers in the sidebar',
    content: 'The Waivers section lives in the sidebar. Expand it to jump directly to Records, Templates, or Group Invites from anywhere in the app.',
  },
  {
    target: '[data-tour="waivers-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Records — today\'s view',
    content: 'Every waiver that has been signed or is pending lands here. By default it shows today\'s records so front-desk staff can quickly verify guests as they walk in.',
  },
  {
    target: '[data-tour="waivers-manage-menu"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Manage menu',
    content: 'The "Manage" drop-down is your shortcut to the rest of the waiver module: Templates, Group Invites, Reports, Deletion Log, and Settings.',
  },
  {
    target: '[data-tour="waivers-assign-btn"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Assign a waiver manually',
    content: 'Use "Assign Waiver" to push a signing link to any guest, even if they didn\'t book online. You can tie it to a booking or send it standalone — the guest gets an email or SMS link.',
  },
  {
    target: '[data-tour="waivers-date-controls"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Date picker',
    content: 'Records default to today to keep the list short. Check "All dates" to see the full history. Turn on Auto-refresh to poll automatically — handy on a front-desk screen.',
  },
  {
    target: '[data-tour="waivers-filter-btns"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Filters & export',
    content: '"Filters" opens a panel where you can narrow by name, email, phone, status, source channel, or marketing consent. "Export" downloads the current filtered set as a CSV.',
  },
  {
    target: '[data-tour="waivers-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Waiver records table',
    content: 'Each row is one waiver. Columns show the signer\'s name, booking link, minors count, visit date, template, location, source channel, marketing consent, and submission time.',
  },
  {
    target: '[data-tour="waivers-row-actions"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Row actions — view, print, delete',
    content: 'Eye opens a full view of the signed waiver. Printer creates a print-ready PDF. Trash (admins only) soft-deletes the record and writes a permanent entry to the Deletion Log.',
  },
];

// ── Waiver Templates  (/waivers/templates) ────────────────────────────────

export const WAIVER_TEMPLATES_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Templates tour',
    content: 'This tour walks you through the Templates page — where you manage every legal form guests sign. Use the arrows or skip at any time.',
  },
  {
    target: '[data-tour="templates-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Templates',
    content: 'Templates are the legal forms guests sign. Each template defines the body text, minor rules, and which activities trigger this waiver automatically at checkout or on the kiosk.',
  },
  {
    target: '[data-tour="templates-new-btn"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Create a new template',
    content: 'Click "New Template" to open the Waiver Builder. You can maintain multiple templates — a general liability waiver, a pool waiver, a climbing waiver — each linked to different activities.',
  },
  {
    target: '[data-tour="templates-search"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Search & status filter',
    content: 'Search by title or description. The status dropdown narrows to Active, Draft, Inactive, or Archived templates. Use the refresh button to pull the latest data.',
  },
  {
    target: '[data-tour="templates-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Templates at a glance',
    content: 'Each row shows the title, status badge, version number (bumped when legal text changes), whether it\'s the default catch-all, and how many activities are assigned.',
  },
  {
    target: '[data-tour="templates-row-actions"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Template row actions',
    content: 'Four buttons per row: tablet icon launches a kiosk session; power icon toggles active/inactive; pencil opens the Builder; trash soft-deletes (moves to the deleted section below).',
  },
  {
    target: '[data-tour="templates-deleted-section"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Deleted templates',
    content: 'Soft-deleted templates are kept here so nothing is lost by accident. "Restore" brings a template back with all settings intact. "Delete permanently" is irreversible and requires admin access.',
  },
];

// ── Waiver Builder  (/waivers/templates/create or /edit) ──────────────────

export const WAIVER_BUILDER_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Builder tour',
    content: 'This tour walks you through every section of the Waiver Builder — where you compose and maintain legal templates. Use the arrows or skip at any time.',
  },
  {
    target: '[data-tour="builder-header"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Builder overview',
    content: 'All changes are saved as versioned snapshots. Active signed waivers always reference the version that was live when signed, so historical records stay accurate even after you update the legal text.',
  },
  {
    target: '[data-tour="builder-save"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Save & kiosk launch',
    content: '"Save Template" persists all changes and bumps the version if body text changed. "Launch Kiosk" opens an active template in a full-screen signing session; "Test Kiosk" previews drafts.',
  },
  {
    target: '[data-tour="builder-basics"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Basics — identity & scope',
    content: 'Set the title shown to guests, an internal description for staff, and the status. Check "Use as default" to make this the catch-all when no activity-specific template matches.',
  },
  {
    target: '[data-tour="builder-body"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Waiver text — the legal content',
    content: 'This is the actual legal text guests read and sign. The version number increments automatically when you save a change here — prior signed waivers are unaffected by updates.',
  },
  {
    target: '[data-tour="builder-tokens"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Token / field picker',
    content: 'Tokens become live data when a guest opens the waiver — e.g. {{adult_name}}, {{visit_date}}. Click any token to insert it at the cursor position in the editor.',
  },
  {
    target: '[data-tour="builder-rules"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Rules — validity, minors & duplicates',
    content: 'Validity days sets how long a signed waiver stays current. Max minors caps how many children an adult can add. Duplicate rule controls whether guests can re-sign within the validity window.',
  },
  {
    target: '[data-tour="builder-clauses"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Clauses — additional acknowledgments',
    content: 'Toggle pre-built clauses that add specific checkboxes guests must tick: photo/video release, medical acknowledgment, property damage liability, group leader clause, and others.',
  },
  {
    target: '[data-tour="builder-marketing"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Marketing consent opt-in',
    content: 'Enable a marketing opt-in section on the form. Guests must actively check the box — it is always unchecked by default. You can customise both the label and the fine-print text.',
  },
  {
    target: '[data-tour="builder-assignments"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Activity assignments',
    content: 'Link this template to packages, attractions, or events. When a guest books a linked activity, this waiver is triggered automatically at checkout or on the kiosk.',
  },
];

// ── Group Invites  (/waivers/bulk) ────────────────────────────────────────

export const WAIVER_BULK_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Group Waiver Invites tour',
    content: 'This tour explains the Group Invites page — designed for school trips, corporate outings, and any large group where one chaperone manages waivers for everyone.',
  },
  {
    target: '[data-tour="bulk-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Group Waiver Invites',
    content: 'Group Invites let one chaperone gather waivers from an entire group before arrival. You create one invite, the chaperone gets a management link, and they handle all individual waivers from a single page.',
  },
  {
    target: '[data-tour="bulk-new-btn"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Create a group invite',
    content: 'Click "New Invite" to open the form. Select the template, set the visit date, enter the chaperone\'s name and contact, and optionally enable a shareable link they can forward to participants.',
  },
  {
    target: '[data-tour="bulk-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Group invites table',
    content: 'Each row shows the chaperone\'s name and contact, visit date, template, how many waivers have been collected, and whether the shareable link is active.',
  },
  {
    target: '[data-tour="bulk-row-actions"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Invite row actions',
    content: 'The link icon copies the chaperone\'s management URL to your clipboard. The send icon resends the email/SMS notification to the chaperone in case they missed it.',
  },
];

// ── Reports  (/waivers/reports) ───────────────────────────────────────────

export const WAIVER_REPORTS_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Reports tour',
    content: 'This tour walks you through the Reports page — your on-demand analytical view into all waiver data. Results render immediately, no scheduled job needed.',
  },
  {
    target: '[data-tour="reports-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Reports',
    content: 'Run reports any time to see completion rates, missing waivers, group invite progress, marketing consent stats, and deleted waiver audits.',
  },
  {
    target: '[data-tour="reports-type-select"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Report type selector',
    content: 'Eight report types: Completed by date, Missing (incomplete waivers), Group invite completion, By event, By template, By source channel, Marketing consent breakdown, and Deleted waivers.',
  },
  {
    target: '[data-tour="reports-date-range"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Date range & Run',
    content: 'Date-range reports show start and end date pickers. Click "Today" to fill both with today\'s date instantly. Hit Run to execute — results appear below in the results panel.',
  },
  {
    target: '[data-tour="reports-results"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Report results',
    content: 'Results render as a table for list-type reports or as stat cards for summaries like marketing consent breakdowns. Use these to track completion rates, audit deletions, and measure channel effectiveness.',
  },
];

// ── Settings  (/waivers/settings) ─────────────────────────────────────────

export const WAIVER_SETTINGS_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Settings tour',
    content: 'This tour walks you through every settings card on this page. These are company-wide defaults that apply to all waivers unless a template overrides them.',
  },
  {
    target: '[data-tour="settings-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Company-wide defaults',
    content: 'Changes here affect all locations and all templates that don\'t have explicit overrides set. Only company admins can save changes.',
  },
  {
    target: '[data-tour="settings-save-btn"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Save button',
    content: 'Always click Save after making changes. There is also a second Save button at the bottom of the page for convenience after scrolling through all the cards.',
  },
  {
    target: '[data-tour="settings-validity-card"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Validity & Duplicates',
    content: 'Default validity days controls how long a signed waiver stays current before requiring a new signature. The duplicate rule sets whether guests can re-sign — block, manager-override only, or always allow.',
  },
  {
    target: '[data-tour="settings-reminders-card"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Reminders & Confirmations',
    content: 'Reminder window (hours) sets how far in advance guests receive an unsigned-waiver nudge before their visit. The toggle below includes the waiver link in every booking confirmation email or SMS.',
  },
  {
    target: '[data-tour="settings-kiosk-card"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Search & Kiosk',
    content: 'Search auto-refresh sets how often the Records page polls for new waivers (0 = off). Kiosk inactivity timeout resets the tablet screen after this many seconds of no interaction. Disable autofill is recommended for shared iPads.',
  },
  {
    target: '[data-tour="settings-permissions-card"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Permissions',
    content: 'Control what each staff role can do: admins deleting waivers, managers printing/exporting, managers building templates, and managers viewing the Deletion Log. Turn off anything that shouldn\'t apply to your team.',
  },
  {
    target: '[data-tour="settings-marketing-card"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Marketing & CRM',
    content: 'Enable marketing consent to show an opt-in checkbox on all waivers. "Only sync when consented" keeps your CRM clean by excluding non-opted guests. "Never use minors\' data" is a legal safeguard for COPPA compliance.',
  },
];

// ── Deletion Log  (/waivers/deletion-log) ─────────────────────────────────

export const WAIVER_DELETION_LOG_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Deletion Log tour',
    content: 'This tour explains the Deletion Log — your permanent compliance and accountability trail for every deleted waiver. This page is read-only.',
  },
  {
    target: '[data-tour="deletion-log-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Deletion Log',
    content: 'Every deleted waiver produces a permanent, immutable audit record here. You can always prove what was deleted, by whom, and when — even after the original record is gone.',
  },
  {
    target: '[data-tour="deletion-log-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Audit table columns',
    content: 'Waiver ID links to the original record number. Guest name and visit date come from the snapshot captured at deletion time. Reason is the note the staff member provided. Deleted by shows who did it, and When shows the exact timestamp.',
  },
];
