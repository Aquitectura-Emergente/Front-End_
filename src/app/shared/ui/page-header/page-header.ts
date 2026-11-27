import { Component, input } from '@angular/core';

/** Encabezado editorial de página con regla graduada. Las acciones se proyectan con [actions]. */
@Component({
  selector: 'ems-page-header',
  template: `
    <header class="ems-page-head">
      <div>
        @if (eyebrow()) {
          <div class="ems-page-head__eyebrow">
            @if (index()) {
              <span class="ems-page-head__index">{{ index() }}</span>
            }
            <span>{{ eyebrow() }}</span>
          </div>
        }
        <h1 class="ems-page-head__title">{{ title() }}</h1>
        @if (description()) {
          <p class="ems-page-head__desc">{{ description() }}</p>
        }
        <ng-content select="[meta]" />
      </div>
      <div class="ems-page-head__actions">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
  styles: `:host { display: block; }`,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly eyebrow = input<string>('');
  readonly index = input<string>('');
  readonly description = input<string>('');
}
