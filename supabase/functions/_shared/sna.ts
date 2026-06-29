// Shared SNA graph helpers for edge functions (M1).

// Relationship valence: conflict negative, cooperation/care positive. Used to
// build the signed positive-tie graph for community/hub analysis.
export function valence(relationType: string, label: string | null): number {
  const l = label ?? ''
  if (relationType === 'conflict' || /갈등|분쟁|기피|거부|편식|다툼/.test(l)) return -2
  if (relationType === 'caregiving' || /돌봄|보살핌/.test(l)) return 1.6
  if (relationType === 'help_seeking' || /협동|양보|도움|위로|배려|나눔/.test(l)) return 1.5
  if (/단짝|친밀|모방/.test(l)) return 1.3
  if (relationType === 'play' || /놀이/.test(l)) return 1
  if (relationType === 'communication' || relationType === 'proximity' || /선호|소통|근접/.test(l)) return 0.8
  return 1
}

// Stronger ties = shorter shortest-path distances (Dijkstra over 1/weight).
export function weightToDistance(w: number): number { return 1 / Math.max(w, 1e-6) }
