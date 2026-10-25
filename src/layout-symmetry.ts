/**
 * How the layout of a dungeon is mirrored or rotated about the centre of the
 * map. `horizontal` mirrors left to right, `vertical` top to bottom, `both`
 * does both at once (four-fold), and `rotational` turns the map by 180°.
 */
export type LayoutSymmetry =
  'none' | 'horizontal' | 'vertical' | 'both' | 'rotational';
