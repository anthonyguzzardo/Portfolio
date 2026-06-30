// Single source of truth for the project list, shared by the desktop canvas
// carousel and the mobile tap list (both in ProjectCarousel.astro). Update
// names here and both presentations stay in sync.
export interface CarouselProject {
  /** ALL-CAPS label rendered in the desktop canvas carousel. */
  name: string;
  /** Title-case label shown in the mobile tap list. */
  display: string;
  link: string;
  /** Brand tile (Mr. Fox). Shown only in the carousel, not the tap list. */
  isImage?: boolean;
  imagePath?: string;
}

export const projects: CarouselProject[] = [
  { name: 'DEALIFIER', display: 'Dealifier', link: 'https://dealifier.com' },
  { name: 'FOX', display: 'Mr. Fox', link: '/', isImage: true, imagePath: '/images/MrFoxSittingLite.png' },
  { name: 'SO FAR SO GOOD', display: 'So Far So Good', link: 'https://hactenusbene.com' },
  { name: 'ALICE', display: 'Alice', link: 'https://fweeo.com/showcase' },
  { name: 'RANGLEY', display: 'Rangley', link: '/rangley' },
];
