import { Component, input } from '@angular/core';

export type EmptyKind = 'empty' | 'error' | 'offline' | 'noPermission';

/** Estado vacío / error / sin conexión con acción opcional proyectada. */
@Component({
  selector: 'ems-empty-state',
  template: `
    <div class="ems-empty" [class.ems-empty--error]="kind() === 'error'" [class.ems-empty--offline]="kind() === 'offline'" [class.ems-empty--compact]="compact()" [attr.role]="kind() === 'error' ? 'alert' : null">
      <span class="ems-empty__icon"><i class="ph {{ iconName() }}" aria-hidden="true"></i></span>
      @if (title()) {
        <span class="ems-empty__title">{{ title() }}</span>
      }
      @if (text()) {
        <span class="ems-empty__text">{{ text() }}</span>
      }
      <ng-content />
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class EmptyState {
  readonly kind = input<EmptyKind>('empty');
  readonly title = input('');
  readonly text = input('');
  readonly icon = input('');
  readonly compact = input(false);

  protected iconName(): string {
    if (this.icon()) return this.icon();
    switch (this.kind()) {
      case 'error': return 'ph-warning-octagon';
      case 'offline': return 'ph-wifi-slash';
      case 'noPermission': return 'ph-lock-key';
      default: return 'ph-tray';
    }
  }
}
