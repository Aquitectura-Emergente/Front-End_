import { Component } from '@angular/core';
import { NavRail, NavSection } from '../nav-rail/nav-rail';

@Component({
  selector: 'app-tech-sidebar',
  imports: [NavRail],
  template: `<app-nav-rail portalKey="nav_techPortal" ariaLabel="Technician navigation" [sections]="sections" />`,
  styles: `:host { display: block; height: 100%; }`,
})
export class TechSidebar {
  protected readonly sections: NavSection[] = [
    {
      labelKey: 'shell_group_work',
      items: [
        { route: '/tech', icon: 'ph-calendar-blank', labelKey: 'nav_mySchedule', exact: true },
        { route: '/tech/work-orders', icon: 'ph-clipboard-text', labelKey: 'nav_workOrders' },
        { route: '/tech/history', icon: 'ph-clock-counter-clockwise', labelKey: 'nav_history' },
      ],
    },
  ];
}
