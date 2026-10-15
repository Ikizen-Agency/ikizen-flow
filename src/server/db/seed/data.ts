/**
 * Seed fixtures derived from the Stitch design screens (customers directory, sales register,
 * kanban board and overview dashboard). Dates are expressed relative to "now" so the
 * dashboard always shows a live-looking six month history.
 */
import type { ActivityCategory } from "../../../modules/activity/domain/activity";
import type { CustomerStatus, CustomerTier } from "../../../modules/customers/domain/customer";
import type { OrderCategory, OrderStatus, PaymentTerms } from "../../../modules/sales/domain/order";
import type { TaskPriority, TaskStatus } from "../../../modules/tasks/domain/task";

export const MEMBERS = [
  { name: "Alex Vance", email: "alex@northstar.studio", role: "Operations Manager" },
  { name: "Maya Chen", email: "maya@northstar.studio", role: "Product Design Lead" },
  { name: "Marcus Miller", email: "marcus@northstar.studio", role: "Account Executive" },
  { name: "Elena Ramos", email: "elena@northstar.studio", role: "Engineering Lead" },
  { name: "Liam Scott", email: "liam@northstar.studio", role: "DevOps Engineer" },
  { name: "Mira Torres", email: "mira@northstar.studio", role: "UI Designer" },
] as const;

export type MemberName = (typeof MEMBERS)[number]["name"];

export interface CustomerFixture {
  company: string;
  tier: CustomerTier;
  status: CustomerStatus;
  industry: string;
  contactName: string;
  contactEmail: string;
  billingEmail?: string;
  paymentTerms?: PaymentTerms;
  /** Hours since last activity. */
  lastActiveHoursAgo: number;
  /** Relative share of the generated order history (0 = no history). */
  historyWeight: number;
  categories: OrderCategory[];
}

export const CUSTOMERS: CustomerFixture[] = [
  { company: "Apex Digital Labs", tier: "enterprise", status: "active", industry: "Technology", contactName: "Sarah Jenkins", contactEmail: "sarah@apexdigital.io", lastActiveHoursAgo: 2, historyWeight: 5, categories: ["custom_software", "ux_ui_retainer"] },
  { company: "Lumina Health Technologies", tier: "retainer", status: "active", industry: "Healthcare", contactName: "Dr. Robert Chen", contactEmail: "r.chen@luminahealth.com", billingEmail: "contact@lumina.io", lastActiveHoursAgo: 26, historyWeight: 4, categories: ["cloud_architecture", "custom_software"] },
  { company: "Hyperion Media Group", tier: "project", status: "pending_review", industry: "Media", contactName: "Elena Rostova", contactEmail: "elena@hyperion.co", billingEmail: "finance@hyperion.com", lastActiveHoursAgo: 24 * 4, historyWeight: 2, categories: ["ux_ui_retainer"] },
  { company: "BlueWave Logistics AG", tier: "enterprise", status: "active", industry: "Logistics", contactName: "Marcus Vance", contactEmail: "m.vance@bluewave.net", billingEmail: "billing@bluewave.ch", lastActiveHoursAgo: 24 * 7, historyWeight: 6, categories: ["custom_software", "cloud_architecture"] },
  { company: "Vanguard Fintech Solutions", tier: "retainer", status: "active", industry: "Financial Services", contactName: "Liam O'Connor", contactEmail: "liam@vanguardfin.com", lastActiveHoursAgo: 24 * 10, historyWeight: 3, categories: ["custom_software"] },
  { company: "Terra Firma Design", tier: "project", status: "inactive", industry: "Architecture", contactName: "Sofia Ramirez", contactEmail: "sofia@terrafirma.org", lastActiveHoursAgo: 24 * 23, historyWeight: 1, categories: ["ux_ui_retainer"] },
  { company: "Acme Logistics Corp", tier: "enterprise", status: "active", industry: "Logistics", contactName: "Daniel Brooks", contactEmail: "d.brooks@acmelogistics.com", lastActiveHoursAgo: 1, historyWeight: 3, categories: ["custom_software"] },
  { company: "Helix Design Labs", tier: "retainer", status: "active", industry: "Design", contactName: "Priya Natarajan", contactEmail: "priya@helixdesign.co", lastActiveHoursAgo: 5, historyWeight: 3, categories: ["ux_ui_retainer"] },
  { company: "Vanguard Robotics", tier: "project", status: "active", industry: "Robotics", contactName: "Owen Hartley", contactEmail: "owen@vanguardrobotics.ai", lastActiveHoursAgo: 24 * 3, historyWeight: 2, categories: ["cloud_architecture"] },
  { company: "Solas Financial", tier: "retainer", status: "active", industry: "Financial Services", contactName: "Grace Okafor", contactEmail: "grace@solasfinancial.com", lastActiveHoursAgo: 24 * 2, historyWeight: 3, categories: ["custom_software", "ux_ui_retainer"] },
  { company: "Aura Health Technologies", tier: "project", status: "active", industry: "Healthcare", contactName: "Sarah Lindqvist", contactEmail: "sarah@auratech.io", lastActiveHoursAgo: 24 * 12, historyWeight: 1, categories: ["ux_ui_retainer"] },
  { company: "Beacon Architectural Studio", tier: "project", status: "active", industry: "Architecture", contactName: "Devon Price", contactEmail: "devon@beacon.build", lastActiveHoursAgo: 24 * 5, historyWeight: 1, categories: ["custom_software"] },
  { company: "Northwind Analytics", tier: "retainer", status: "archived", industry: "Data & Analytics", contactName: "Hannah Weiss", contactEmail: "hannah@northwind.dev", lastActiveHoursAgo: 24 * 160, historyWeight: 0, categories: ["cloud_architecture"] },
  { company: "Orbit Commerce", tier: "project", status: "pending_review", industry: "Retail", contactName: "Jonas Becker", contactEmail: "jonas@orbitcommerce.shop", lastActiveHoursAgo: 24 * 6, historyWeight: 1, categories: ["custom_software"] },
];

export interface OrderFixture {
  customer: string;
  title: string;
  description?: string;
  category: OrderCategory;
  status: OrderStatus;
  paymentTerms?: PaymentTerms;
  amountCents: number;
  /** Days before "now" the order was issued. */
  issuedDaysAgo: number;
  invoiceNumber?: string;
  items?: Array<{ title: string; description?: string; quantity: number; unit?: "unit" | "hours"; unitRateCents: number }>;
}

/**
 * Orders shown explicitly in the designs, oldest first. They receive the highest references
 * (SL-1039 ... SL-1048) after the generated history.
 */
export const DESIGN_ORDERS: OrderFixture[] = [
  { customer: "Solas Financial", title: "Web Portal Optimization", category: "custom_software", status: "processing", amountCents: 295000, issuedDaysAgo: 22 },
  { customer: "Vanguard Robotics", title: "Cloud Telemetry Migration", category: "cloud_architecture", status: "pending", amountCents: 520000, issuedDaysAgo: 20 },
  { customer: "Helix Design Labs", title: "Design System Sprint 4", category: "ux_ui_retainer", status: "completed", amountCents: 185000, issuedDaysAgo: 18 },
  { customer: "Acme Logistics Corp", title: "Enterprise API Retainer", category: "custom_software", status: "completed", amountCents: 340000, issuedDaysAgo: 16 },
  { customer: "Orbit Commerce", title: "Checkout Experience Discovery", category: "ux_ui_retainer", status: "draft", amountCents: 240000, issuedDaysAgo: 9 },
  { customer: "Vanguard Fintech Solutions", title: "Payments Ledger Hardening", category: "custom_software", status: "completed", amountCents: 320000, issuedDaysAgo: 8 },
  { customer: "BlueWave Logistics AG", title: "Fleet Routing Platform Phase 2", category: "custom_software", status: "completed", amountCents: 760000, issuedDaysAgo: 6 },
  {
    customer: "Hyperion Media Group",
    title: "Q4 UX Architecture & Prototyping Retainer",
    description: "Core user experience flows, design sprint facilitation, Figma design tokens",
    category: "ux_ui_retainer",
    status: "invoiced",
    amountCents: 1240000,
    issuedDaysAgo: 4,
    invoiceNumber: "INV-2047",
    items: [
      { title: "Q4 UX Architecture & Prototyping Retainer", description: "Core user experience flows, design sprint facilitation, Figma design tokens", quantity: 1, unitRateCents: 850000 },
      { title: "Brand System Extension", description: "Campaign templates and motion guidelines", quantity: 1, unitRateCents: 390000 },
    ],
  },
  { customer: "Apex Digital Labs", title: "Mobile SDK Architecture", category: "custom_software", status: "draft", amountCents: 660000, issuedDaysAgo: 3,
    items: [{ title: "Cloud Infrastructure CI/CD Migration", description: "Automated deployment triggers, Dockerized staging containers, zero-downtime blue/green swap", quantity: 40, unit: "hours", unitRateCents: 16500 }] },
  { customer: "Lumina Health Technologies", title: "Patient Portal Accessibility Audit", category: "cloud_architecture", status: "completed", amountCents: 485000, issuedDaysAgo: 2 },
];

/** Invoices that are past due in the design ("Overdue Receivables & Collections"). */
export const OVERDUE_ORDERS: OrderFixture[] = [
  { customer: "Aura Health Technologies", title: "Mobile App Redesign", category: "ux_ui_retainer", status: "invoiced", amountCents: 320000, issuedDaysAgo: 42, invoiceNumber: "INV-2018" },
  { customer: "Beacon Architectural Studio", title: "BIM Integration", category: "custom_software", status: "invoiced", amountCents: 320000, issuedDaysAgo: 35, invoiceNumber: "INV-2023" },
];

/** Monthly revenue targets (in cents) for the generated history, oldest month first (5 months back to last month). */
export const HISTORY_MONTHLY_TARGETS = [1180000, 1460000, 1840000, 1560000, 2090000] as const;

export const HISTORY_TITLES: Record<OrderCategory, string[]> = {
  custom_software: ["Platform Feature Sprint", "Integration Build-out", "API Modernisation", "Internal Tools Release", "Data Pipeline Iteration"],
  ux_ui_retainer: ["Monthly Design Retainer", "UX Research Sprint", "Design System Maintenance", "Prototype Iteration"],
  cloud_architecture: ["Infrastructure Audit", "Cost Optimisation Review", "Kubernetes Hardening", "Observability Rollout"],
};

export interface TaskFixture {
  code: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  customer: string | null;
  assignee: MemberName | null;
  /** Due date as [days from today, local hour, minute]; null for no due date. */
  due: [number, number, number] | null;
  estimateHours?: number;
  /** Logged time (tracked hours are derived from these entries). */
  timeEntries?: Array<{ member: string; hours: number; note: string; daysAgo: number }>;
  /** Text files written to the attachment storage when the seed runs with one. */
  attachments?: Array<{ fileName: string; uploadedBy: string; content: string; daysAgo: number }>;
  blockedReason?: string;
  tags?: string[];
  /** Real comments; `@{Member Name}` becomes a mention token at seed time. */
  comments?: Array<{ author: string; body: string; hoursAgo: number }>;
  /** Days ago the task was completed (completed tasks only). */
  completedDaysAgo?: number;
  subtasks?: Array<[string, boolean]>;
}

export const TASKS: TaskFixture[] = [
  { code: "TASK-831", title: "Invoice #INV-2039 Reconciliation", status: "completed", priority: "medium", customer: null, assignee: "Alex Vance", due: [-8, 17, 0], completedDaysAgo: 8, tags: ["Finance"] },
  { code: "TASK-833", title: "Client Onboarding & Slack Connect Room Setup", status: "completed", priority: "medium", customer: "Apex Digital Labs", assignee: "Maya Chen", due: [-1, 12, 0], completedDaysAgo: 1, tags: ["Onboarding"] },
  { code: "TASK-835", title: "Update Figma Design System tokens", status: "todo", priority: "low", customer: null, assignee: "Mira Torres", due: [25, 17, 0], tags: ["Design System"] },
  { code: "TASK-836", title: "Quarterly Financial Audit Reconciliation", status: "in_progress", priority: "medium", customer: null, assignee: "Maya Chen", due: [16, 17, 0], tags: ["Finance"] },
  {
    code: "TASK-837", title: "Draft API Documentation for Mobile SDK", status: "todo", priority: "medium", customer: "Apex Digital Labs", assignee: "Maya Chen", due: [20, 17, 0], tags: ["Documentation"],
    subtasks: [["Outline authentication flows", false], ["Document webhook payloads", false], ["Publish SDK quick start", false]],
  },
  {
    code: "TASK-838", title: "Prepare SOC2 Compliance Evidence for BlueWave", status: "todo", priority: "high", customer: "BlueWave Logistics AG", assignee: "Alex Vance", due: [1, 17, 0], tags: ["Compliance"],
    subtasks: [["Export access review logs", true], ["Collect change management tickets", true], ["Vendor risk questionnaire", false], ["Incident response runbook", false], ["Encryption key rotation evidence", false]],
  },
  { code: "TASK-839", title: "Deploy Staging Environment Kubernetes Cluster", status: "in_progress", priority: "high", customer: "Lumina Health Technologies", assignee: "Liam Scott", due: [14, 17, 0], tags: ["Infrastructure"],
    timeEntries: [{ member: "Liam Scott", hours: 3.5, note: "Cluster provisioning and node pools", daysAgo: 2 }],
    comments: [
      { author: "Liam Scott", body: "Node pools are provisioned; waiting on the ingress certificates before the smoke test.", hoursAgo: 30 },
      { author: "Elena Ramos", body: "@{Liam Scott} certificates are issued, you can run the smoke test now.", hoursAgo: 6 },
    ],
  },
  { code: "TASK-840", title: "Brand Guideline Approval & Asset Sign-off", status: "blocked", priority: "urgent", customer: "Hyperion Media Group", assignee: "Alex Vance", due: [-2, 17, 0], blockedReason: "Waiting on client sign-off", tags: ["Brand"] },
  { code: "TASK-841", title: "Stripe Connect Merchant Verification", status: "blocked", priority: "high", customer: "Vanguard Fintech Solutions", assignee: "Liam Scott", due: [11, 17, 0], blockedReason: "Pending Stripe review", tags: ["Payments"] },
  {
    code: "TASK-842",
    title: "Deliver Q4 UX Architecture Wireframes",
    description:
      "Comprehensive interaction schematics and information architecture diagrams for Apex Digital's multi-tenant billing flow. Must validate cross-device responsiveness with their product design board before handover to frontend engineering sprint.",
    status: "in_progress", priority: "urgent", customer: "Apex Digital Labs", assignee: "Alex Vance", due: [0, 17, 0], estimateHours: 16, tags: ["UX"],
    timeEntries: [
      { member: "Alex Vance", hours: 8, note: "Checkout navigation tree and subscription selectors", daysAgo: 3 },
      { member: "Alex Vance", hours: 6, note: "Billing state machine edge cases and invoice history", daysAgo: 1 },
    ],
    attachments: [
      {
        fileName: "wireframe-handover-notes.txt",
        uploadedBy: "Alex Vance",
        daysAgo: 1,
        content:
          "Q4 UX architecture wireframes - handover notes\n\n1. Checkout navigation tree mapped (12 nodes).\n2. Subscription selector states: upgrade, downgrade (needs confirmation step), pause.\n3. Responsive breakpoints annotated for 375, 768, 1280 and 1440 px.\n",
      },
    ],
    comments: [
      { author: "Maya Chen", body: "Uploaded the feedback synthesis from last quarter's interviews to the shared drive.", hoursAgo: 52 },
      { author: "Alex Vance", body: "Checkout node tree is mapped. @{Maya Chen} can you sanity-check the subscription selector states?", hoursAgo: 26 },
      { author: "Maya Chen", body: "Looks solid. Only the downgrade path needs a confirmation step.", hoursAgo: 20 },
      { author: "Mira Torres", body: "@{Alex Vance} the responsive breakpoints are annotated, ready for the handover review.", hoursAgo: 2 },
    ],
    subtasks: [
      ["Audit previous quarterly user feedback notes", true], ["Map checkout navigation node tree", true], ["Design multi-tier subscription selectors in Figma", true],
      ["Define billing state machine edge cases", true], ["Wireframe invoice history views", true], ["Wireframe seat management modal", true],
      ["Annotate responsive breakpoints", true], ["Accessibility contrast review", true],
      ["Incorporate Stripe Elements 3D Secure verification fallback", false], ["Review high-fidelity prototypes with Maya Chen", false],
    ],
  },
  { code: "TASK-843", title: "Finalize Stripe webhook retry handling", status: "in_progress", priority: "urgent", customer: "Solas Financial", assignee: "Maya Chen", due: [0, 14, 30], tags: ["Payments"] },
  { code: "TASK-844", title: "Deliver design review to Helix stakeholders", status: "todo", priority: "high", customer: "Helix Design Labs", assignee: "Marcus Miller", due: [0, 16, 0], tags: ["Design"] },
  { code: "TASK-845", title: "Review AWS billing line items", status: "todo", priority: "medium", customer: null, assignee: "Elena Ramos", due: [1, 10, 0], tags: ["Finance"] },
];

export interface ActivityFixture {
  actor: MemberName;
  message: string;
  category: ActivityCategory;
  minutesAgo: number;
}

export const ACTIVITY: ActivityFixture[] = [
  { actor: "Maya Chen", message: "marked Invoice #INV-2041 as Paid", category: "billing", minutesAgo: 18 },
  { actor: "Marcus Miller", message: "qualified new inbound lead Acme Logistics", category: "pipeline", minutesAgo: 60 },
  { actor: "Alex Vance", message: "scheduled Q4 Operational Review with partners", category: "strategy", minutesAgo: 180 },
  { actor: "Elena Ramos", message: "completed milestone deployment for Helix", category: "development", minutesAgo: 300 },
  { actor: "Liam Scott", message: "provisioned staging cluster for Lumina Health", category: "development", minutesAgo: 60 * 20 },
  { actor: "Alex Vance", message: "sent payment reminder to Aura Health Technologies", category: "billing", minutesAgo: 60 * 28 },
  { actor: "Marcus Miller", message: "moved Orbit Commerce to proposal stage", category: "pipeline", minutesAgo: 60 * 50 },
  { actor: "Mira Torres", message: "published design token update v2.4", category: "operations", minutesAgo: 60 * 76 },
];

/** Demo login (development only). Alex owns both seeded workspaces. */
export const DEMO_USER = {
  name: "Alex Vance",
  email: "alex@northstar.studio",
  password: "ikizen-demo-123",
} as const;

export const NORTHSTAR_WORKSPACE = { name: "Northstar Studio", slug: "northstar-studio", tagline: "Digital Operations" } as const;

/** Second, small workspace so the workspace switcher has real data to switch to. */
export interface SandboxFixture {
  name: string;
  slug: string;
  tagline: string;
  members: Array<{ name: string; email: string; role: string }>;
  customers: Array<Omit<CustomerFixture, "historyWeight" | "categories">>;
  orders: OrderFixture[];
  tasks: Array<Omit<TaskFixture, "assignee"> & { assignee: string | null }>;
  activity: Array<Omit<ActivityFixture, "actor"> & { actor: string }>;
}

export const SANDBOX_WORKSPACE: SandboxFixture = {
  name: "Helix Labs Sandbox",
  slug: "helix-labs-sandbox",
  tagline: "R&D Experiments",
  members: [
    { name: "Alex Vance", email: "alex@northstar.studio", role: "Lab Director" },
    { name: "Noah Patel", email: "noah@helixlabs.dev", role: "Research Engineer" },
  ],
  customers: [
    { company: "Quanta Bioworks", tier: "project", status: "active", industry: "Biotech", contactName: "Iris Novak", contactEmail: "iris@quantabio.com", lastActiveHoursAgo: 6 },
    { company: "Polaris Mobility", tier: "retainer", status: "active", industry: "Automotive", contactName: "Theo Lindgren", contactEmail: "theo@polarismobility.eu", lastActiveHoursAgo: 30 },
    { company: "Kite Learning", tier: "project", status: "pending_review", industry: "Education", contactName: "Amara Diallo", contactEmail: "amara@kitelearning.org", lastActiveHoursAgo: 24 * 4 },
  ],
  orders: [
    { customer: "Quanta Bioworks", title: "Lab Data Platform Prototype", category: "custom_software", status: "completed", amountCents: 640000, issuedDaysAgo: 48, invoiceNumber: "INV-1900" },
    { customer: "Polaris Mobility", title: "Fleet Telemetry Architecture Review", category: "cloud_architecture", status: "invoiced", amountCents: 380000, issuedDaysAgo: 12, invoiceNumber: "INV-1901" },
    { customer: "Kite Learning", title: "Learner Dashboard UX Sprint", category: "ux_ui_retainer", status: "pending", amountCents: 210000, issuedDaysAgo: 3 },
  ],
  tasks: [
    { code: "TASK-101", title: "Benchmark sequencing ingestion pipeline", status: "in_progress", priority: "high", customer: "Quanta Bioworks", assignee: "Noah Patel", due: [2, 17, 0], tags: ["Research"] },
    { code: "TASK-102", title: "Draft telemetry review findings", status: "todo", priority: "medium", customer: "Polaris Mobility", assignee: "Alex Vance", due: [5, 12, 0], tags: ["Architecture"] },
    { code: "TASK-103", title: "Set up sandbox CI runners", status: "completed", priority: "low", customer: null, assignee: "Noah Patel", due: [-3, 17, 0], completedDaysAgo: 3, tags: ["Infrastructure"] },
  ],
  activity: [
    { actor: "Noah Patel", message: "started benchmark runs for Quanta Bioworks", category: "development", minutesAgo: 45 },
    { actor: "Alex Vance", message: "invoiced Polaris Mobility for the telemetry review", category: "billing", minutesAgo: 60 * 26 },
  ],
};
