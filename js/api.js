const API_BASE_URL = '/api';

/**
 * Fetch all seats for an event
 * @param {string} eventId - Event ID (season, packageA, packageB, event1, event2, event3)
 * @returns {Promise<Array>} Array of seat objects with indirect holds/kills
 */
async function fetchSeatsForEvent(eventId) {
  const response = await fetch(`${API_BASE_URL}/seats/${eventId}/with-indirect`);
  if (!response.ok) {
    throw new Error(`Failed to fetch seats for event ${eventId}`);
  }
  return response.json();
}

/**
 * Update not_for_sale flag for a seat
 * @param {number} seatId - Seat database ID
 * @param {boolean} notForSale - Whether seat should be marked as not for sale
 * @returns {Promise<Object>} Updated seat object
 */
async function updateSeatNotForSale(seatId, notForSale) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/not-for-sale`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notForSale }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update seat ${seatId}`);
  }
  return response.json();
}

/**
 * Apply a direct hold to a seat
 * @param {number} seatId - Seat database ID
 * @param {string} holdName - Hold name (Red, Green, Blue, Orange)
 * @returns {Promise<Object>} Updated seat object
 */
async function applyDirectHold(seatId, holdName) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/hold`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ holdName }),
  });
  if (!response.ok) {
    throw new Error(`Failed to apply hold to seat ${seatId}`);
  }
  return response.json();
}

/**
 * Remove a direct hold from a seat
 * @param {number} seatId - Seat database ID
 * @returns {Promise<Object>} Updated seat object
 */
async function removeDirectHold(seatId) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/hold`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove hold from seat ${seatId}`);
  }
  return response.json();
}

/**
 * Apply a direct kill to a seat
 * @param {number} seatId - Seat database ID
 * @param {string} killName - Kill name (Red, Green, Blue, Orange)
 * @returns {Promise<Object>} Updated seat object
 */
async function applyDirectKill(seatId, killName) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/kill`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ killName }),
  });
  if (!response.ok) {
    throw new Error(`Failed to apply kill to seat ${seatId}`);
  }
  return response.json();
}

/**
 * Remove a direct kill from a seat
 * @param {number} seatId - Seat database ID
 * @returns {Promise<Object>} Updated seat object
 */
async function removeDirectKill(seatId) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/kill`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove kill from seat ${seatId}`);
  }
  return response.json();
}

/**
 * Batch update seats (for not_for_sale flags)
 * @param {Array<{id: number, notForSale: boolean}>} updates - Array of seat updates
 * @returns {Promise<Array>} Array of updated seat objects
 */
async function batchUpdateSeats(updates) {
  const response = await fetch(`${API_BASE_URL}/seats/batch-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ updates }),
  });
  if (!response.ok) {
    throw new Error('Failed to batch update seats');
  }
  return response.json();
}

/**
 * Reset all seats (clear holds, kills, set not_for_sale to false)
 * @returns {Promise<Object>} Success response
 */
async function resetAllSeats() {
  const response = await fetch(`${API_BASE_URL}/seats/reset-all`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to reset all seats');
  }
  return response.json();
}

/**
 * Add seat to cart
 * @param {number} seatId - Seat database ID
 * @returns {Promise<Object>} Updated seat object
 */
async function addToCart(seatId) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/add-to-cart`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to add seat ${seatId} to cart`);
  }
  return response.json();
}

/**
 * Sell a seat
 * @param {number} seatId - Seat database ID
 * @returns {Promise<Object>} Updated seat object
 */
async function sellSeat(seatId) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/sell`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to sell seat ${seatId}`);
  }
  return response.json();
}

/**
 * Reserve a seat
 * @param {number} seatId - Seat database ID
 * @returns {Promise<Object>} Updated seat object
 */
async function reserveSeat(seatId) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/reserve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to reserve seat ${seatId}`);
  }
  return response.json();
}

/**
 * List a seat for resale
 * @param {number} seatId - Seat database ID
 * @returns {Promise<Object>} Updated seat object
 */
async function listSeat(seatId) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/list`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to list seat ${seatId} for resale`);
  }
  return response.json();
}

/**
 * Resell a seat
 * @param {number} seatId - Seat database ID
 * @returns {Promise<Object>} Updated seat object
 */
async function resellSeat(seatId) {
  const response = await fetch(`${API_BASE_URL}/seats/${seatId}/resell`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to resell seat ${seatId}`);
  }
  return response.json();
}

/**
 * Get all state categories with memberships
 * @returns {Promise<Array>} Array of category objects with states
 */
async function getStateCategories() {
  const response = await fetch(`${API_BASE_URL}/state-categories`);
  if (!response.ok) {
    throw new Error('Failed to fetch state categories');
  }
  return response.json();
}

/**
 * Create a new state category
 * @param {string} name - Category name
 * @param {number} displayOrder - Display order (optional)
 * @returns {Promise<Object>} Created category object
 */
async function createStateCategory(name, displayOrder) {
  const response = await fetch(`${API_BASE_URL}/state-categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, displayOrder }),
  });
  if (!response.ok) {
    throw new Error('Failed to create state category');
  }
  return response.json();
}

/**
 * Update state category name
 * @param {number} categoryId - Category ID
 * @param {string} name - New category name
 * @returns {Promise<Object>} Updated category object
 */
async function updateStateCategoryName(categoryId, name) {
  const response = await fetch(`${API_BASE_URL}/state-categories/${categoryId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error('Failed to update state category');
  }
  return response.json();
}

/**
 * Delete state category
 * @param {number} categoryId - Category ID
 * @returns {Promise<Object>} Success response
 */
async function deleteStateCategory(categoryId) {
  const response = await fetch(`${API_BASE_URL}/state-categories/${categoryId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete state category');
  }
  return response.json();
}

/**
 * Update state category memberships
 * @param {number} categoryId - Category ID
 * @param {string[]} stateNames - Array of state names to assign to category
 * @returns {Promise<Object>} Success response
 */
async function updateStateCategoryMemberships(categoryId, stateNames) {
  const response = await fetch(`${API_BASE_URL}/state-categories/${categoryId}/memberships`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stateNames }),
  });
  if (!response.ok) {
    throw new Error('Failed to update state category memberships');
  }
  return response.json();
}

/**
 * Initialize default state category
 * @returns {Promise<Object>} Success response
 */
async function initializeDefaultStateCategory() {
  const response = await fetch(`${API_BASE_URL}/state-categories/initialize-default`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to initialize default state category');
  }
  return response.json();
}

// Export for browser use
if (typeof window !== 'undefined') {
  window.seatAPI = {
    fetchSeatsForEvent,
    updateSeatNotForSale,
    applyDirectHold,
    removeDirectHold,
    applyDirectKill,
    removeDirectKill,
    batchUpdateSeats,
    resetAllSeats,
    addToCart,
    sellSeat,
    reserveSeat,
    listSeat,
    resellSeat,
    getStateCategories,
    createStateCategory,
    updateStateCategoryName,
    deleteStateCategory,
    updateStateCategoryMemberships,
    initializeDefaultStateCategory,
  };
}

