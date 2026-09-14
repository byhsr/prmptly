export interface ForceNode {
  id: string
}

export interface ForceEdge {
  source: string
  target: string
}

export interface ForceOptions {
  iterations?: number
  repulsion?: number
  linkDistance?: number
  gravity?: number
  seedRadius?: number
}

export interface ForcePoint {
  x: number
  y: number
}

// Deterministic force-directed layout (spring-electric with centre gravity).
// Seeded on a circle by index so the result is stable across renders — no RNG.
export function forceLayout(
  nodes: ForceNode[],
  edges: ForceEdge[],
  options: ForceOptions = {}
): Map<string, ForcePoint> {
  const iterations = options.iterations ?? 220
  const repulsion = options.repulsion ?? 9000
  const linkDistance = options.linkDistance ?? 130
  const gravity = options.gravity ?? 0.02
  const seedRadius = options.seedRadius ?? Math.max(120, nodes.length * 18)

  const positions = new Map<string, ForcePoint>()

  nodes.forEach((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2
    positions.set(node.id, {
      x: Math.cos(angle) * seedRadius,
      y: Math.sin(angle) * seedRadius,
    })
  })

  if (nodes.length <= 1) return positions

  const ids = nodes.map((n) => n.id)
  const links = edges.filter((e) => positions.has(e.source) && positions.has(e.target))

  for (let step = 0; step < iterations; step++) {
    const displacement = new Map<string, ForcePoint>()
    for (const id of ids) displacement.set(id, { x: 0, y: 0 })

    // Repulsion between every pair
    for (let i = 0; i < ids.length; i++) {
      const a = positions.get(ids[i])!
      const da = displacement.get(ids[i])!
      for (let j = i + 1; j < ids.length; j++) {
        const b = positions.get(ids[j])!
        let dx = a.x - b.x
        let dy = a.y - b.y
        let distSq = dx * dx + dy * dy
        if (distSq < 0.01) {
          // Nudge apart deterministically instead of using randomness
          dx = (i - j) || 0.5
          dy = 0.5
          distSq = dx * dx + dy * dy
        }
        const dist = Math.sqrt(distSq)
        const force = repulsion / distSq
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        da.x += fx
        da.y += fy
        const db = displacement.get(ids[j])!
        db.x -= fx
        db.y -= fy
      }
    }

    // Attraction along links
    for (const link of links) {
      const a = positions.get(link.source)!
      const b = positions.get(link.target)!
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const force = (dist - linkDistance) * 0.05
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      displacement.get(link.source)!.x -= fx
      displacement.get(link.source)!.y -= fy
      displacement.get(link.target)!.x += fx
      displacement.get(link.target)!.y += fy
    }

    // Gravity toward the centre keeps isolated nodes from drifting away
    for (const id of ids) {
      const point = positions.get(id)!
      const d = displacement.get(id)!
      d.x -= point.x * gravity
      d.y -= point.y * gravity
    }

    // Cool down over time and apply, capped per step
    const cooling = 1 - step / iterations
    const maxStep = 40 * cooling + 1

    for (const id of ids) {
      const point = positions.get(id)!
      const d = displacement.get(id)!
      const magnitude = Math.sqrt(d.x * d.x + d.y * d.y) || 1
      const scale = Math.min(magnitude, maxStep) / magnitude
      point.x += d.x * scale
      point.y += d.y * scale
    }
  }

  return positions
}
