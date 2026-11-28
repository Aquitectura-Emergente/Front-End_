import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

/** Paginación de tablas (páginas base 0, como el backend). */
@Component({
  selector: 'ems-pager',
  imports: [TranslatePipe],
  template: `
    <footer class="ems-pager">
      <span>
        @if (total() > 0) {
          <span class="mono">{{ from() }}–{{ to() }}</span> {{ 'ui_of' | t }} <span class="mono">{{ total() }}</span>
        }
      </span>
      @if (totalPages() > 1) {
        <nav class="ems-pager__controls" aria-label="Pagination">
          <button class="ems-btn ems-btn--sm ems-btn--icon" type="button" aria-label="Previous" [disabled]="page() === 0" (click)="pageChange.emit(page() - 1)">
            <i class="ph ph-caret-left" aria-hidden="true"></i>
          </button>
          @for (p of pages(); track p) {
            <button class="ems-btn ems-btn--sm ems-btn--icon num" type="button" [class.ems-btn--primary]="p === page()" [attr.aria-current]="p === page() ? 'page' : null" (click)="pageChange.emit(p)">{{ p + 1 }}</button>
          }
          <button class="ems-btn ems-btn--sm ems-btn--icon" type="button" aria-label="Next" [disabled]="page() >= totalPages() - 1" (click)="pageChange.emit(page() + 1)">
            <i class="ph ph-caret-right" aria-hidden="true"></i>
          </button>
        </nav>
      }
    </footer>
  `,
  styles: `:host { display: block; } .num { font-family: var(--ems-font-mono); }`,
})
export class Pager {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly pageChange = output<number>();

  protected from = computed(() => this.page() * this.pageSize() + 1);
  protected to = computed(() => Math.min((this.page() + 1) * this.pageSize(), this.total()));
  protected pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i));
}
