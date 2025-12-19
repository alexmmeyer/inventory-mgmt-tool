// Parent-child relationships for event propagation
const parentMaps = {
  packageA: ['event1', 'event2', 'event3'],
  packageB: ['event2', 'event3'],
};

const childMaps = {
  event1: ['packageA'],
  event2: ['packageA', 'packageB'],
  event3: ['packageA', 'packageB'],
};

/**
 * Get all related event IDs for indirect hold/kill propagation
 * @param {string} eventId - The event ID where the direct hold/kill was placed
 * @returns {string[]} Array of related event IDs
 */
function getRelatedEvents(eventId) {
  const related = new Set();
  
  // If it's a parent (package), add all children
  if (parentMaps[eventId]) {
    parentMaps[eventId].forEach(child => related.add(child));
    
    // Also add other parents that share the same children
    Object.keys(parentMaps).forEach(otherParent => {
      if (otherParent !== eventId) {
        parentMaps[eventId].forEach(child => {
          if (parentMaps[otherParent] && parentMaps[otherParent].includes(child)) {
            related.add(otherParent);
          }
        });
      }
    });
  }
  
  // If it's a child (event), only add its own parent(s)
  // Do NOT propagate to siblings or other parents
  if (childMaps[eventId]) {
    childMaps[eventId].forEach(parent => related.add(parent));
  }
  
  return Array.from(related);
}

module.exports = {
  parentMaps,
  childMaps,
  getRelatedEvents,
};

