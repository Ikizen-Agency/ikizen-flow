export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Shown in the primary mobile bottom bar (others go to the "More" sheet). */
  primaryOnMobile: boolean;
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/", label: "Overview", icon: "dashboard", primaryOnMobile: true },
  { href: "/customers", label: "Customers", icon: "group", primaryOnMobile: true },
  { href: "/sales", label: "Sales", icon: "trending_up", primaryOnMobile: true },
  { href: "/tasks", label: "Tasks", icon: "check_box", primaryOnMobile: true },
  { href: "/invoices", label: "Invoices", icon: "receipt_long", primaryOnMobile: false },
  { href: "/reports", label: "Reports", icon: "bar_chart", primaryOnMobile: false },
  { href: "/settings", label: "Settings", icon: "settings", primaryOnMobile: false },
];

/** True when `pathname` is the item route or one of its children. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
