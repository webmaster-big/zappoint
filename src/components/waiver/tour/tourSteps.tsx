import type { Step } from 'react-joyride';

const row = (label: string, desc: string) => (
  <div style={{ marginBottom: 12, textAlign: 'left' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6366f1', flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{label}</span>
    </div>
    <div style={{ paddingLeft: 15, fontSize: 12, color: '#64748b', lineHeight: 1.55, textAlign: 'left' }}>{desc}</div>
  </div>
);

// ── Waiver Records  (/waivers) ─────────────────────────────────────────────

export const WAIVER_RECORDS_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Records tour',
    content: 'This tour walks you through every feature on this page. Use Next / Back to move at your own pace, or skip any time.',
  },
  {
    target: '[data-tour="waivers-sidebar"]',
    placement: 'right',
    disableBeacon: true,
    title: 'Waivers in the sidebar',
    content: 'Expand the Waivers item in the sidebar to jump directly to Records, Templates, or Group Invites from anywhere in the app.',
  },
  {
    target: '[data-tour="waivers-heading"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Waiver Records — today\'s view',
    content: 'Every signed or pending waiver lands here. It defaults to today\'s date so front-desk staff can verify a guest the moment they arrive.',
  },
  {
    target: '[data-tour="waivers-manage-menu"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Manage menu',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>One-click shortcuts to the rest of the waiver module:</p>
        <div>
          {row('Templates', 'build and manage legal forms')}
          {row('Group Invites', 'batch waivers for school trips / events')}
          {row('Reports', 'on-demand analytics and exports')}
          {row('Deletion Log', 'permanent audit trail of deletions')}
          {row('Settings', 'company-wide defaults (admin only)')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="waivers-assign-btn"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Assign a waiver manually',
    content: 'Sends a personal signing link to any guest by email or SMS — useful for walk-ins or guests who missed the checkout link. Optionally attach it to a specific booking.',
  },
  {
    target: '[data-tour="waivers-date-controls"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Date picker & auto-refresh',
    content: (
      <>
        <div>
          {row('Date picker', 'defaults to today — change to browse historical records')}
          {row('All dates', 'removes the date filter entirely to see every waiver')}
          {row('Auto-refresh', 'polls automatically every N seconds — great for a front-desk screen')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="waivers-filter-btns"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Filters & export',
    content: (
      <>
        <div>
          {row('Filters', 'narrow by name, email, phone, status, source channel, or marketing consent')}
          {row('Refresh', 'manually reload the list at any time')}
          {row('Export', 'downloads the current filtered set as a CSV file')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="waivers-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Waiver records table',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>Each row is one waiver. Key columns:</p>
        <div>
          {row('Name', 'signer\'s full name and contact info')}
          {row('Linked to', 'booking or purchase this waiver is tied to')}
          {row('Minors', 'number of children added to this waiver')}
          {row('Source', 'how the guest received the link (kiosk, email, SMS…)')}
          {row('Marketing', 'whether the guest opted into marketing')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="waivers-row-actions"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Row actions',
    content: (
      <>
        <div>
          {row('Eye icon', 'opens the full signed waiver text in a modal')}
          {row('Printer icon', 'generates a print-ready PDF in a new tab')}
          {row('Trash icon', 'soft-deletes (admins only) and writes to the Deletion Log')}
        </div>
      </>
    ),
  },
];

// ── Waiver Templates  (/waivers/templates) ────────────────────────────────

export const WAIVER_TEMPLATES_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Templates tour',
    content: 'This tour covers the Templates page — where you manage every legal form guests sign. Use Next / Back to move through it, or skip any time.',
  },
  {
    target: '[data-tour="templates-heading"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Waiver Templates',
    content: 'Templates are the legal forms guests sign. Each template has its own body text, minor rules, and a list of activities (packages, attractions, events) that trigger it automatically at checkout or on the kiosk.',
  },
  {
    target: '[data-tour="templates-new-btn"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Create a new template',
    content: 'Opens the Waiver Builder. You can maintain multiple templates in parallel — a general liability waiver, a pool waiver, a climbing waiver — each assigned to different activities.',
  },
  {
    target: '[data-tour="templates-search"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Search & status filter',
    content: (
      <>
        <div>
          {row('Search box', 'filter by title or internal description')}
          {row('Status dropdown', 'narrow to Active, Draft, Inactive, or Archived')}
          {row('Refresh button', 'pull the latest data from the server')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="templates-table"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Templates table',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>Each row shows:</p>
        <div>
          {row('Title', 'click to open the Builder for that template')}
          {row('Status', 'Active / Draft / Inactive / Archived')}
          {row('Version', 'increments every time legal text is saved')}
          {row('Default', 'catch-all used when no activity-specific template matches')}
          {row('Assignments', 'number of activities linked to this template')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="templates-row-actions"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Template row actions',
    content: (
      <>
        <div>
          {row('Tablet icon', 'launch a kiosk signing session (active) or preview (draft)')}
          {row('Power icon', 'toggle the template active / inactive instantly')}
          {row('Pencil icon', 'open the Waiver Builder to edit this template')}
          {row('Trash icon', 'soft-delete — moves it to the deleted section below')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="templates-deleted-section"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Deleted templates',
    content: (
      <>
        <div>
          {row('Restore', 'brings the template back with all settings intact')}
          {row('Delete permanently', 'irreversible — requires admin access')}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>Click the toggle to expand the deleted templates list.</p>
      </>
    ),
  },
];

// ── Waiver Builder  (/waivers/templates/create or /edit) ──────────────────

export const WAIVER_BUILDER_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Builder tour',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>This tour walks through every section of the Builder — the tool you use to compose, version, and activate legal waiver templates.</p>
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Use Next / Back to move through each section, or skip at any time. The tour takes about 2 minutes.</p>
      </>
    ),
  },
  {
    target: '[data-tour="builder-header"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Builder heading & versioning',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>The page header shows whether you are creating a new template or editing an existing one.</p>
        <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>Every time you save changes to the <strong style={{ color: '#1e293b' }}>Waiver Text</strong>, the system creates a new version automatically. Guests who already signed keep their original version — historical records are never altered.</p>
      </>
    ),
  },
  {
    target: '[data-tour="builder-save"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Save & kiosk buttons',
    content: (
      <>
        <div>
          {row('Save Template', 'saves all fields; increments the version number only when the waiver text has changed')}
          {row('Launch Kiosk', 'opens an active template in a full-screen kiosk signing session (visible only on edit)')}
          {row('Test Kiosk', 'opens a draft / inactive template so you can preview signing without publishing it')}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>A second Save button also appears at the very bottom of the form for convenience.</p>
      </>
    ),
  },
  {
    target: '[data-tour="builder-basics"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Basics — identity & scope',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>These fields identify the template and control where it applies.</p>
        <div>
          {row('Title', 'the name shown to guests at the top of the signing form — required')}
          {row('Internal description', 'private staff notes; never visible to guests')}
          {row('Status', 'Draft (hidden), Active (live), Inactive (paused), or Archived (retired)')}
          {row('Use as default', 'makes this the catch-all template when no activity-specific one matches')}
          {row('Location', 'restrict to a single venue, or leave blank to apply company-wide')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="builder-body"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Waiver text — the legal body',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>This is the full legal text your attorney drafts. Type or paste it here.</p>
        <div>
          {row('Text area', 'write the waiver; insert tokens (see the right panel) to auto-fill guest data when signing')}
          {row('Preview toggle', 'switches between edit mode and a rendered preview where tokens are replaced with their labels — e.g. {{adult_first_name}} shows as "John"')}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>Changing this field on save creates a new version. Previous signed waivers always reference the version they were signed on.</p>
      </>
    ),
  },
  {
    target: '[data-tour="builder-tokens"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Insert a field (tokens)',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>Tokens are placeholders that fill in with real guest and booking data at signing time. Click any token to insert it at your cursor in the text area.</p>
        <div>
          {row('Company group', 'business name, email, phone')}
          {row('Location group', 'location name and address')}
          {row('Activity & date group', 'activity name, booking date, visit date')}
          {row('Guardian / signer group', 'full name, first/last name, email, phone, relationship')}
          {row('General group', 'current date, current year')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="builder-rules"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Rules — validity, minors & duplicates',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>These settings control how the waiver behaves over time and who can sign it.</p>
        <div>
          {row('Validity (days)', 'how many days a signed waiver stays valid; leave blank for no expiry')}
          {row('Max minors', 'maximum number of children an adult can add in one signing; set to 0 to hide the minors section entirely')}
          {row('Duplicate rule', '"Block" prevents re-signing; "Manager-assigned only" lets managers assign a new one; "Allow" permits guests to sign again')}
          {row('24-hour reminder', 'when checked, an automatic reminder is sent to guests whose pending waiver is still unsigned the day before their visit')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="builder-clauses"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Clauses & fields',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>Toggle optional sections that add specific fields or checkboxes to the signing form.</p>
        <div>
          {row('Minor section', 'shows the "Add a child" panel; required if you want minors on waivers')}
          {row('Require minor date of birth', 'makes the DOB field mandatory for each child added')}
          {row('Require minor relationship', 'makes the relationship field (e.g. Parent, Guardian) mandatory per child')}
          {row('Photo / video release', 'adds a consent checkbox for the venue to use images from the visit')}
          {row('Medical acknowledgment', 'adds a checkbox confirming the guest is aware of health requirements')}
          {row('Property damage', 'adds a liability clause for damage the guest may cause')}
          {row('Group leader clause', 'the signer accepts responsibility for everyone in their group')}
          {row('Electronic signature consent', 'requires the guest to explicitly confirm their typed name is a legal signature')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="builder-marketing"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Marketing consent opt-in',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>When the toggle is on, a marketing opt-in checkbox appears at the bottom of the signing form.</p>
        <div>
          {row('Marketing consent opt-in toggle', 'enables or disables the entire marketing section on the form')}
          {row('Consent text', 'the main sentence guests see next to the checkbox — e.g. "Keep me updated on events and offers"')}
          {row('Helper text (fine print)', 'optional smaller text shown below the consent sentence for extra detail')}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>The checkbox is always unchecked by default — guests must actively opt in.</p>
      </>
    ),
  },
  {
    target: '[data-tour="builder-assignments"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Activity assignments',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>Link this template to activities so the waiver triggers automatically when a guest books.</p>
        <div>
          {row('Packages', 'tick any packages that should require this waiver at checkout or on the kiosk')}
          {row('Attractions', 'tick any attractions (day-pass, pay-per-ride, etc.) that require this waiver')}
          {row('Events', 'tick any events that should collect this waiver from attendees')}
          {row('Select all / Clear', 'quick links to check or uncheck all items in a category at once')}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>Each activity can only belong to one template. Activities already claimed by another template do not appear in the list.</p>
      </>
    ),
  },
];

// ── Group Invites  (/waivers/bulk) ────────────────────────────────────────

export const WAIVER_BULK_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Group Waiver Invites tour',
    content: 'This tour explains Group Invites — designed for school trips, corporate outings, and any large group where one chaperone manages waivers for everyone.',
  },
  {
    target: '[data-tour="bulk-heading"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Group Waiver Invites',
    content: 'You create one invite, the chaperone gets a management link, and they collect each participant\'s individual waiver from a single page — before the group ever arrives.',
  },
  {
    target: '[data-tour="bulk-new-btn"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Create a group invite',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>Fill in the form to create an invite and notify the chaperone:</p>
        <div>
          {row('Template', 'which waiver form each participant will sign')}
          {row('Visit date', 'the group\'s visit date (pre-fills all participant waivers)')}
          {row('Chaperone name', 'the person responsible for collecting waivers')}
          {row('Email / Phone', 'where to send the management link')}
          {row('Shareable link', 'lets the chaperone forward a signing link to participants')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="bulk-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Group invites table',
    content: (
      <>
        <div>
          {row('Chaperone', 'name and contact info for the group leader')}
          {row('Template', 'which waiver form is being collected')}
          {row('Date', 'the group\'s scheduled visit date')}
          {row('Contacts', 'number of participants who have been added so far')}
          {row('Shareable', 'whether the chaperone\'s link can be forwarded')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="bulk-row-actions"]',
    placement: 'left',
    disableBeacon: true,
    title: 'Invite row actions',
    content: (
      <>
        <div>
          {row('Link icon', 'copies the chaperone\'s management URL to your clipboard')}
          {row('Send icon', 'resends the email / SMS invite to the chaperone')}
        </div>
      </>
    ),
  },
];

// ── Reports  (/waivers/reports) ───────────────────────────────────────────

export const WAIVER_REPORTS_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Reports tour',
    content: 'This tour covers the Reports page — on-demand analytics for all your waiver data. Results render immediately in the browser, no export job needed.',
  },
  {
    target: '[data-tour="reports-heading"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Waiver Reports',
    content: 'Run any report at any time to get instant visibility into completion rates, missing waivers, group invite progress, source channel performance, and consent stats.',
  },
  {
    target: '[data-tour="reports-type-select"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Report type selector',
    content: (
      <>
        <p style={{ margin: 0, marginBottom: 8 }}>Choose from 8 report types:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', fontSize: 12, color: '#64748b' }}>
          <div>• Completed by date</div>
          <div>• By event</div>
          <div>• Missing (incomplete)</div>
          <div>• By template</div>
          <div>• Group invite completion</div>
          <div>• By source channel</div>
          <div>• Marketing consent</div>
          <div>• Deleted waivers</div>
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="reports-date-range"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Date range',
    content: (
      <>
        <div>
          {row('Start date / End date', 'shown only for date-based reports')}
          {row('"Today" button', 'fills both date fields with today\'s date instantly')}
          {row('"Run" button', 'executes the selected report — results appear below')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="reports-results"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Report results',
    content: (
      <>
        <div>
          {row('Table view', 'used for list-type reports (completed by date, missing…)')}
          {row('Stat cards', 'used for summary reports (marketing consent breakdown)')}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>No data for the selected range shows an empty state with a chart icon.</p>
      </>
    ),
  },
];

// ── Settings  (/waivers/settings) ─────────────────────────────────────────

export const WAIVER_SETTINGS_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Settings tour',
    content: 'This tour walks through every settings card on this page. These are company-wide defaults for all waivers. Only company admins can save changes.',
  },
  {
    target: '[data-tour="settings-heading"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Company-wide defaults',
    content: 'Settings here apply to all locations and all templates that don\'t have explicit overrides set at the template level. Changes take effect immediately after saving.',
  },
  {
    target: '[data-tour="settings-save-btn"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Save button',
    content: 'Always click Save after making changes. A second Save button is also at the very bottom of the page — whichever is more convenient after scrolling through the cards.',
  },
  {
    target: '[data-tour="settings-validity-card"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Validity & Duplicates',
    content: (
      <>
        <div>
          {row('Default validity days', 'how long a signed waiver stays current (blank = never expires)')}
          {row('Default expiration days', 'separate expiration window if different from validity')}
          {row('Default duplicate rule', 'Block re-signing, Manager-only override, or Always allow')}
          {row('Waivers expire toggle', 'makes waivers actually expire after the validity window')}
          {row('Require new on text change', 'forces guests to re-sign if the legal text changes')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="settings-reminders-card"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Reminders & Confirmations',
    content: (
      <>
        <div>
          {row('Reminder window (hours)', 'send a nudge this many hours before the visit (e.g. 24 = day before)')}
          {row('Include link in confirmation', 'always attach the waiver signing URL to booking confirmations')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="settings-kiosk-card"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Search & Kiosk',
    content: (
      <>
        <div>
          {row('Search auto-refresh (s)', 'how often the Records page polls for new waivers (0 = off)')}
          {row('Kiosk inactivity reset (s)', 'resets the kiosk screen after this many seconds of no interaction')}
          {row('Disable autofill', 'prevents browser autofill on kiosk devices — recommended for shared iPads')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="settings-permissions-card"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Permissions',
    content: (
      <>
        <div>
          {row('Admins can delete waivers', 'controls whether the trash icon appears on the Records page')}
          {row('Managers can print & export', 'allows managers to use the print PDF and CSV export features')}
          {row('Managers can build templates', 'lets managers open the Waiver Builder and edit templates')}
          {row('Managers can view Deletion Log', 'controls access to the audit trail page')}
        </div>
      </>
    ),
  },
  {
    target: '[data-tour="settings-marketing-card"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Marketing & CRM',
    content: (
      <>
        <div>
          {row('Enable marketing consent', 'adds a marketing opt-in checkbox to all waiver forms')}
          {row('Only sync when consented', 'keeps your CRM clean by excluding guests who didn\'t opt in')}
          {row('Never use minors\' data', 'legal safeguard — disables marketing for children\'s records')}
        </div>
      </>
    ),
  },
];

// ── Deletion Log  (/waivers/deletion-log) ─────────────────────────────────

export const WAIVER_DELETION_LOG_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    title: 'Waiver Deletion Log tour',
    content: 'This tour explains the Deletion Log — a permanent, immutable audit trail for every deleted waiver. This page is read-only.',
  },
  {
    target: '[data-tour="deletion-log-heading"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Waiver Deletion Log',
    content: 'Every deleted waiver produces a permanent audit record here. You can always prove what was deleted, by whom, and when — even after the original record is gone.',
  },
  {
    target: '[data-tour="deletion-log-table"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Audit table columns',
    content: (
      <>
        <div>
          {row('Waiver #', 'the original waiver ID number')}
          {row('Guest', 'name captured in the snapshot at deletion time')}
          {row('Visit date', 'the guest\'s visit date from the snapshot')}
          {row('Reason', 'note the staff member provided when deleting')}
          {row('Deleted by', 'which staff member performed the deletion')}
          {row('When', 'the exact timestamp of the deletion')}
        </div>
      </>
    ),
  },
];
