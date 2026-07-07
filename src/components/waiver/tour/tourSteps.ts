import type { Step } from 'react-joyride';

// ── Waiver Records  (/waivers) ─────────────────────────────────────────────

export const WAIVER_RECORDS_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Records tour',
    content: 'This tour walks you through every feature on the Waiver Records page. Use the arrows to move at your own pace, or skip at any time. The "Replay tour" button in the bottom-right corner lets you restart whenever you need a refresher.',
  },
  {
    target: '[data-tour="waivers-sidebar"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Waivers in the sidebar',
    content: 'The Waivers section lives in your sidebar. Expand it to jump directly to Records, Templates, or Group Invites. Reports, Settings, and the Deletion Log are reachable from the Manage menu on this page.',
  },
  {
    target: '[data-tour="waivers-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Records — the live dashboard',
    content: 'Every waiver that has been signed or is pending lands here. By default it shows today\'s records so front-desk staff can verify a guest the moment they walk in.',
  },
  {
    target: '[data-tour="waivers-manage-menu"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Manage menu',
    content: 'The "Manage" drop-down is your shortcut to the rest of the module: Templates, Group Invites, Reports, Deletion Log, and Settings. It\'s always one click away from the Records page.',
  },
  {
    target: '[data-tour="waivers-assign-btn"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Assign a waiver manually',
    content: 'Use "Assign Waiver" to push a signing link to any guest, even if they didn\'t book online. You can attach it to a booking or send it standalone. The guest gets an email or SMS with a personalised link.',
  },
  {
    target: '[data-tour="waivers-date-controls"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Date picker & auto-refresh',
    content: 'Records default to today so the list stays short and relevant. Check "All dates" to see the full history. Turn on Auto-refresh to poll automatically every few seconds — handy on a front-desk screen where you want real-time updates without manual refreshing.',
  },
  {
    target: '[data-tour="waivers-filter-btns"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Filters & export',
    content: '"Filters" expands a panel where you can narrow results by name, email, phone, status (pending / expired / replaced), source channel, or marketing consent. "Export" downloads the current filtered set as a CSV — useful for compliance reports or mailing lists.',
  },
  {
    target: '[data-tour="waivers-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Waiver records table',
    content: 'Each row is one waiver. Columns show the signer\'s name and contact, whether it\'s linked to a booking or activity purchase, the number of minors covered, the visit date, which template was used, location, source channel, and marketing consent status.',
  },
  {
    target: '[data-tour="waivers-row-actions"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Row actions — view, print, delete',
    content: 'The eye icon opens a full view of the signed waiver. The printer icon creates a print-ready version. The trash icon (admins only) soft-deletes the record and writes an entry to the Deletion Log with a full audit trail.',
  },
];

// ── Waiver Templates  (/waivers/templates) ────────────────────────────────

export const WAIVER_TEMPLATES_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Templates tour',
    content: 'This tour walks you through the Templates page — where you manage every legal form guests sign. Use the arrows or skip at any time. Hit "Replay tour" in the bottom-right to restart.',
  },
  {
    target: '[data-tour="templates-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Templates',
    content: 'Templates are the legal forms your guests sign. Each template defines the body text, required clauses, minor rules, and which activities (packages, attractions, events) trigger this waiver automatically at checkout or on the kiosk.',
  },
  {
    target: '[data-tour="templates-new-btn"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Create a new template',
    content: 'Click "New Template" to open the Waiver Builder. You can maintain multiple templates simultaneously — a general liability waiver, a pool waiver, a climbing waiver — each triggered by different activities.',
  },
  {
    target: '[data-tour="templates-search"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Search & status filter',
    content: 'Search by title or internal description. The status filter lets you narrow to Active (currently collecting signatures), Draft (still being built), Inactive, or Archived templates. Use the refresh button to pull the latest data.',
  },
  {
    target: '[data-tour="templates-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Templates at a glance',
    content: 'Each row shows: title, status badge, version number (bumped when you change the legal text), whether it\'s the default/catch-all waiver, and a count of how many packages, attractions, and events are assigned to it.',
  },
  {
    target: '[data-tour="templates-row-actions"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Template actions',
    content: 'Four actions per row: (1) Launch/Test Kiosk — opens this template in tablet kiosk mode. (2) Toggle active/inactive — flip the template on or off without deleting it. (3) Edit — opens the Waiver Builder. (4) Delete — soft-deletes the template and moves it to the Deleted section below.',
  },
  {
    target: '[data-tour="templates-deleted-section"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Deleted templates',
    content: 'Soft-deleted templates are kept here so nothing is permanently lost by accident. Click this toggle to expand the list. "Restore" brings a template back with all its settings intact. "Delete permanently" is irreversible — only company admins can use it.',
  },
];

// ── Waiver Builder  (/waivers/templates/create or /edit) ──────────────────

export const WAIVER_BUILDER_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Builder tour',
    content: 'This tour walks you through every section of the Waiver Builder — where you compose and maintain legal templates. Use the arrows or skip at any time. "Replay tour" is always available in the bottom-right.',
  },
  {
    target: '[data-tour="builder-header"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Builder overview',
    content: 'The Builder is where you compose and maintain templates. All changes are saved as versioned snapshots — active signed waivers always reference the version that was live when signed, so historical records remain accurate even after you update the legal text.',
  },
  {
    target: '[data-tour="builder-save"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Save & kiosk launch',
    content: '"Save Template" persists all changes and bumps the version if the legal body text changed. If the template is already active, "Launch Kiosk" opens it in a full-screen tablet-friendly signing session. "Test Kiosk" previews draft templates before they go live.',
  },
  {
    target: '[data-tour="builder-basics"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Basics — identity & scope',
    content: 'Set the template\'s title (shown to guests), an internal description (staff-only notes), and status. Check "Use as default" to make this the catch-all waiver when no activity-specific template matches. Optionally restrict it to a single location, or leave blank for company-wide.',
  },
  {
    target: '[data-tour="builder-body"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Waiver text — the legal content',
    content: 'This is the actual legal text your attorney drafts. Type or paste it directly into the textarea. Use the Preview toggle to see how tokens render with real data. The version number increments automatically when you save a change to this field — prior signed waivers are unaffected.',
  },
  {
    target: '[data-tour="builder-tokens"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Token / field picker',
    content: 'Tokens are placeholders that become live data when a guest opens the waiver — e.g. {{adult_name}}, {{visit_date}}, {{location_name}}. Click any token to insert it at the current cursor position in the editor. They are grouped by category: Signer info, Visit info, Company info, Minors.',
  },
  {
    target: '[data-tour="builder-rules"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Rules — validity, minors & duplicates',
    content: 'Validity days: how long a signed waiver stays current (blank = no expiry). Max minors: maximum children an adult can add (0 disables the minors section). Duplicate rule: "Block" prevents re-signing within the validity window; "Manager-assigned only" lets staff override; "Allow" always permits. The reminder toggle sends a 24-hour nudge for unsigned pending waivers.',
  },
  {
    target: '[data-tour="builder-clauses"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Clauses & fields',
    content: 'Toggle pre-built clauses that add specific acknowledgments to the form: minor section, DOB required, relationship required, photo/video release, medical acknowledgment, property damage liability, group leader clause, and electronic signature consent. Each enabled clause adds a checkbox the guest must tick.',
  },
  {
    target: '[data-tour="builder-marketing"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Marketing consent opt-in',
    content: 'Enable a marketing opt-in section on the form. Guests see a checkbox to receive future promotions from your venue. It is always unchecked by default — guests must actively opt in. You can customise both the consent label text and the helper fine-print below it.',
  },
  {
    target: '[data-tour="builder-assignments"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Activity assignments',
    content: 'Link this template to specific packages, attractions, or events. When a guest books a linked activity, this waiver is automatically triggered at checkout, in confirmation emails, or on the kiosk. Each activity can only belong to one template — already-claimed activities are hidden to prevent conflicts.',
  },
];

// ── Group Invites  (/waivers/bulk) ────────────────────────────────────────

export const WAIVER_BULK_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Group Waiver Invites tour',
    content: 'This tour explains the Group Invites page — designed for school trips, corporate outings, and any large-group visit where one chaperone manages waivers for the whole group.',
  },
  {
    target: '[data-tour="bulk-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Group Waiver Invites',
    content: 'Group Invites let one chaperone gather waivers from an entire group before arrival. You create one invite, notify the chaperone, and they manage all individual waivers from a single page — before the group arrives.',
  },
  {
    target: '[data-tour="bulk-new-btn"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Create a group invite',
    content: 'Click "New Invite" to open the form. Select the waiver template, set the visit date, enter the chaperone\'s name and contact (email and/or phone), and choose whether to allow a shareable link the chaperone can forward to participants. Submitting sends the chaperone a management link instantly.',
  },
  {
    target: '[data-tour="bulk-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Group invites table',
    content: 'Each row shows the chaperone\'s name and contact, visit date, template used, waivers collected so far, and whether the shareable link is active. Action buttons let you copy the management link or resend the email/SMS notification to the chaperone.',
  },
];

// ── Reports  (/waivers/reports) ───────────────────────────────────────────

export const WAIVER_REPORTS_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Reports tour',
    content: 'This tour walks you through the Reports page — your analytical view into all waiver data. Results render immediately in the browser with no scheduled job needed.',
  },
  {
    target: '[data-tour="reports-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Reports',
    content: 'Reports give you on-demand analytical visibility into your waiver data. Run them any time — every result renders immediately in the browser.',
  },
  {
    target: '[data-tour="reports-controls"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Report controls',
    content: 'Eight report types: Completed by date, Missing (incomplete waivers for a range), Group invite completion, By event, By template, By source channel, Marketing consent breakdown, and Deleted waivers. Date-range reports have start/end pickers; "Today" fills both at once. Click Run to execute.',
  },
  {
    target: '[data-tour="reports-results"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Report results',
    content: 'Results render as a table for list-type reports or as stat cards for summaries. Use these to track completion rates by template, find guests who haven\'t signed before a visit, audit which source channels are most effective, and check marketing consent opt-in rates over time.',
  },
];

// ── Settings  (/waivers/settings) ─────────────────────────────────────────

export const WAIVER_SETTINGS_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Settings tour',
    content: 'This tour walks you through the Settings page — company-wide defaults that apply to every waiver unless overridden at the template level. Only company admins can edit these.',
  },
  {
    target: '[data-tour="settings-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Settings — company-wide defaults',
    content: 'These settings apply to every waiver in the system unless a template overrides them. Changes here affect all locations and all templates that don\'t have explicit overrides. Only company admins can save changes.',
  },
  {
    target: '[data-tour="settings-cards"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Five setting groups',
    content: 'Settings are organised into five cards:\n\n• Validity & Duplicates — default validity window and duplicate policy.\n• Reminders & Confirmations — when to send reminders and whether to include the waiver link in booking confirmations.\n• Search & Kiosk — auto-refresh interval, kiosk inactivity timeout, and disable-autofill toggle for shared kiosk devices.\n• Permissions — which roles can delete waivers, print/export, build templates, and view the Deletion Log.\n• Marketing & CRM — company-wide marketing consent toggle, CRM sync rules, and minor data protection.',
  },
];

// ── Deletion Log  (/waivers/deletion-log) ─────────────────────────────────

export const WAIVER_DELETION_LOG_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Deletion Log tour',
    content: 'This tour explains the Deletion Log — your permanent compliance and accountability trail for every deleted waiver.',
  },
  {
    target: '[data-tour="deletion-log-heading"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Waiver Deletion Log',
    content: 'Every deleted waiver produces a permanent, immutable audit record here. You can always prove what was deleted, by whom, and when — even after the original record is gone. This page is read-only.',
  },
  {
    target: '[data-tour="deletion-log-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Audit table',
    content: 'Each row shows: the waiver ID, guest name from the snapshot, visit date, any reason the staff member provided, who deleted it, and the timestamp. The snapshot captures key fields at deletion time so the guest\'s name and date are preserved even after the record is removed. Deleted waivers cannot be recovered from this log.',
  },
];
