import type { ComponentType } from 'react';
import {
  BanknoteIcon,
  BedDoubleIcon,
  BellIcon,
  ClipboardListIcon,
  DropletIcon,
  DropletsIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  PlugZapIcon,
  ReceiptTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TimerOffIcon,
  UsersIcon,
  WrenchIcon,
  ZapIcon
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string; }>;
  superuserOnly?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboardIcon },
      { label: 'Reminders', to: '/reminders', icon: BellIcon }
    ]
  },
  {
    label: 'Property',
    items: [
      { label: 'Rooms', to: '/rooms', icon: BedDoubleIcon },
      { label: 'Customers', to: '/customers', icon: UsersIcon },
      { label: 'Leases', to: '/leases', icon: ClipboardListIcon }
    ]
  },
  {
    label: 'Electricity & Water',
    items: [
      { label: 'Electricity', to: '/electricity', icon: ZapIcon },
      { label: 'Electricity payments', to: '/electricity-payments', icon: PlugZapIcon },
      { label: 'Water', to: '/water', icon: DropletIcon },
      { label: 'Water payments', to: '/water-payments', icon: DropletsIcon }
    ]
  },
  {
    label: 'Billing',
    items: [
      { label: 'Bills', to: '/bills', icon: ReceiptTextIcon },
      { label: 'Rent payments', to: '/payments', icon: BanknoteIcon },
      { label: 'Overdue', to: '/overdue', icon: TimerOffIcon }
    ]
  },
  {
    label: 'Maintenance',
    items: [{ label: 'Room repairs', to: '/repairs', icon: WrenchIcon }]
  },
  {
    label: 'Insights',
    items: [{ label: 'Reports', to: '/reports', icon: FileTextIcon }]
  },
  {
    label: 'Administration',
    items: [
      { label: 'Staff accounts', to: '/staff', icon: ShieldCheckIcon, superuserOnly: true },
      { label: 'Settings & Updates', to: '/settings', icon: SettingsIcon }
    ]
  }
];
