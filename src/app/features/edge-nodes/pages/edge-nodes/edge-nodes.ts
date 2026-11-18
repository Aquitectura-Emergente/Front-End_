import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LowerCasePipe } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { formatDateTime, timeAgo } from '../../../../core/utils/time';
import { DeviceManagementFacade } from '../../../../contexts/devicemanagement/application/device-management-facade';
import { EdgeNodeView } from '../../../../contexts/devicemanagement/domain/edge-node.model';
import { UserFacade } from '../../../../contexts/iam/application/user-facade';

type SegmentFilter = 'all' | EdgeNodeView['segment'];

/** Nodos Edge que reportan a Device Management, de planta y de hogar. Solo lectura. */
@Component({
  selector: 'app-edge-nodes',
  imports: [TranslatePipe, FormsModule, LowerCasePipe],
  templateUrl: './edge-nodes.html',
  styleUrl: './edge-nodes.scss',
})
export class EdgeNodes implements OnInit {
  private dm    = inject(DeviceManagementFacade);
  private users = inject(UserFacade);

  loading  = signal(true);
  edges    = signal<EdgeNodeView[]>([]);
  /** Nombre del cliente empresa (u hogar) por id de organización. */
  orgNames = signal<Map<number, string>>(new Map());
  segment  = signal<SegmentFilter>('all');
  search   = signal('');

  filtered = computed(() => {
    const seg = this.segment();
    const q = this.search().trim().toLowerCase();
    return this.edges().filter(e =>
      (seg === 'all' || e.segment === seg) &&
      (!q || e.edgeNodeId.toLowerCase().includes(q) || this.orgName(e).toLowerCase().includes(q))
    );
  });

  online  = computed(() => this.edges().filter(e => e.connectivity === 'ONLINE').length);
  offline = computed(() => this.edges().filter(e => e.connectivity === 'OFFLINE').length);

  ngOnInit(): void {
    this.dm.edges().subscribe(list => {
      this.edges.set(list);
      this.loading.set(false);
    });
    this.users.all().subscribe(list =>
      this.orgNames.set(new Map(list.filter(u => u.role === 'Client').map(u => [u.id, u.name])))
    );
  }

  orgName(e: EdgeNodeView): string {
    return e.organizationId != null ? this.orgNames().get(e.organizationId) ?? `#${e.organizationId}` : '—';
  }

  ago(iso: string | null): string {
    return timeAgo(iso);
  }

  when(iso: string | null): string {
    return formatDateTime(iso);
  }
}
