import { Component } from '@angular/core';
import { NavRail, NavSection } from '../nav-rail/nav-rail';

@Component({
  selector: 'app-sidebar',
  imports: [NavRail],
  template: `<app-nav-rail portalKey="shell_portal_admin" ariaLabel="Admin navigation" [sections]="sections" />`,
  styles: `:host { display: block; height: 100%; }`,
})
export class Sidebar {
  protected readonly sections: NavSection[] = [
    {
      items: [{ route: '/admin', icon: 'ph-squares-four', labelKey: 'nav_dashboard', exact: true }],
    },
    {
      labelKey: 'shell_group_operations',
      items: [
        { route: '/admin/work-orders', icon: 'ph-clipboard-text', labelKey: 'nav_workOrders' },
        { route: '/admin/calendar', icon: 'ph-calendar-dots', labelKey: 'nav_calendar' },
        { route: '/admin/history', icon: 'ph-clock-counter-clockwise', labelKey: 'nav_history' },
      ],
    },
    {
      labelKey: 'shell_group_assets',
      items: [
        { route: '/admin/devices', icon: 'ph-cpu', labelKey: 'nav_devices' },
        { route: '/admin/edge-nodes', icon: 'ph-broadcast', labelKey: 'nav_edgeNodes' },
      ],
    },
    {
      labelKey: 'shell_group_monitoring',
      items: [
        { route: '/admin/map-radiation', icon: 'ph-map-pin', labelKey: 'nav_mapRadiation' },
        { route: '/admin/alarms', icon: 'ph-bell', labelKey: 'nav_alarms' },
      ],
    },
    {
      labelKey: 'shell_group_people',
      items: [{ route: '/admin/users', icon: 'ph-users', labelKey: 'nav_users' }],
    },
  ];
}
