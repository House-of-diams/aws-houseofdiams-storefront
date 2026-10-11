import 'server-only'

// RDS is the sole pricing/history transport. Reads do not enable order placement;
// write repositories and payment routes retain their separate release gate.
export function isF7ReadPreviewEnabled() {
  return true
}
