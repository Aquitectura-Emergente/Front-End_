import { Component, input } from '@angular/core';

/**
 * Marca oficial de EMSafe (escudo con la E y el pulso). Conserva el cian del
 * logotipo; el resto de la interfaz no usa ese color.
 */
@Component({
  selector: 'ems-brand-mark',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2.5 4.5 7v8.2c0 7 4.8 12.3 11.5 14.3 6.7-2 11.5-7.3 11.5-14.3V7L16 2.5Z"
            stroke="#3FE3EC" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M12 10h8.5M12 10v12h8.5M12 16h6" stroke="#3FE3EC" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M3 16h5l1.6-3 2 6 1.4-3H19l1.4-2.6 1.8 5.2 1.4-2.6H29" stroke="#3FE3EC" stroke-width="1.3"
            stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    </svg>
    @if (wordmark()) {
      <span class="wordmark">EMSafe</span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; color: inherit; }
    .wordmark {
      font-family: var(--ems-font-heading);
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: 0.02em;
      line-height: 1;
    }
  `,
})
export class BrandMark {
  readonly size = input(28);
  readonly wordmark = input(false);
}
