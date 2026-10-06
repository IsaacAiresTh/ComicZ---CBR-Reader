import type { SVGProps } from 'react';

/**
 * Icones de traco, desenhados inline.
 *
 * Substituem os glifos soltos (✓ ★ ✎ 🗑 ↻) que o site usava como botao: emoji
 * muda de desenho entre sistemas, nao herda a cor do texto e nao tem tamanho
 * previsivel ao lado de uma palavra. Todos herdam `currentColor` e medem 1em
 * por padrao, entao seguem o texto em volta sem classe nenhuma.
 */
type Props = SVGProps<SVGSVGElement>;

function Base({ children, strokeWidth = 2, ...props }: Props) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconBook = (p: Props) => (
  <Base {...p}>
    <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z" />
    <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
  </Base>
);
export const IconStar = ({ filled, ...p }: Props & { filled?: boolean }) => (
  <Base {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
  </Base>
);
export const IconBookmark = ({ filled, ...p }: Props & { filled?: boolean }) => (
  <Base {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </Base>
);
export const IconFolderPlus = (p: Props) => (
  <Base {...p}>
    <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M12 10v6M9 13h6" />
  </Base>
);
export const IconCheck = (p: Props) => (
  <Base {...p}>
    <path d="m5 12 5 5 9-10" />
  </Base>
);
export const IconMore = (p: Props) => (
  <Base {...p} fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </Base>
);
export const IconSearch = (p: Props) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);
export const IconEdit = (p: Props) => (
  <Base {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </Base>
);
export const IconTrash = (p: Props) => (
  <Base {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Base>
);
export const IconRefresh = (p: Props) => (
  <Base {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </Base>
);
export const IconUpload = (p: Props) => (
  <Base {...p}>
    <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
  </Base>
);
export const IconX = (p: Props) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
export const IconHome = (p: Props) => (
  <Base {...p}>
    <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Base>
);
export const IconGrid = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="9" rx="1" />
    <rect x="3" y="15" width="7" height="6" rx="1" />
    <rect x="14" y="15" width="7" height="6" rx="1" />
  </Base>
);
export const IconUser = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Base>
);
export const IconLayers = (p: Props) => (
  <Base {...p}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
  </Base>
);
export const IconList = (p: Props) => (
  <Base {...p}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </Base>
);
export const IconGrip = (p: Props) => (
  <Base {...p} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </Base>
);
export const IconArrowLeft = (p: Props) => (
  <Base {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);
export const IconArrowRight = (p: Props) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);
export const IconExternal = (p: Props) => (
  <Base {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
  </Base>
);
export const IconAlert = (p: Props) => (
  <Base {...p}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 10v4M12 17h.01" />
  </Base>
);
export const IconDownload = (p: Props) => (
  <Base {...p}>
    <path d="M12 4v12M6 10l6 6 6-6M4 20h16" />
  </Base>
);
