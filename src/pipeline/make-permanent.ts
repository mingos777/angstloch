/**
 * Marks an error that no other map could fix, so that `pipeline` throws it at
 * once and does not build the map again. Returns the error.
 */
export function makePermanent<E extends Error>(
  error: E,
): E & { permanent: true } {
  return Object.assign(error, { permanent: true as const });
}
