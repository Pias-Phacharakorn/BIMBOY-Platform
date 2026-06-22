import * as React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'bim-panel': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string;
        "header-hidden"?: boolean | string;
      };
      'bim-panel-section': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string;
        icon?: string;
        collapsed?: boolean | string;
        name?: string;
      };
      'bim-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string;
        icon?: string;
        disabled?: boolean | string;
        checked?: boolean | string;
      };
      'bim-text-input': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string;
        value?: string;
        placeholder?: string;
      };
      'bim-checkbox': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string;
        checked?: boolean | string;
      };
      'bim-label': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        icon?: string;
        label?: string;
      };
      'bim-grid': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'bim-viewport': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'bim-context-menu': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
