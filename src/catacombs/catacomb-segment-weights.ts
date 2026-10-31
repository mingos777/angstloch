/** How likely each character of a segment of `digCatacombs` is to be drawn. Only the ratio matters, so the weights need not add up to 1, and a missing one is 0. */
export interface CatacombSegmentWeights {
  /** The weight of a segment whose walls are lined with niches. */
  niches?: number;
  /** The weight of a segment whose walls are lined with burial chambers. */
  chambers?: number;
  /** The weight of a segment with bare walls. */
  bare?: number;
}
