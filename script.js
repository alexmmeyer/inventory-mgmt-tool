const parentMaps = {
  packageA: ['event1', 'event2', 'event3'],
  packageB: ['event2', 'event3']
};

const childMaps = {
  event1: ['packageA'],
  event2: ['packageA', 'packageB'],
  event3: ['packageA', 'packageB']
};

const seatMaps = ['season', 'packageA', 'packageB', 'event1', 'event2', 'event3'];
// Store seat data by event: { eventId: { seatKey: seatData } }
// seatKey format: `${ticketType}-${section}-${row}-${seat}`
let seatDataByEvent = {};
// Map seat database IDs to seat elements
let seatElementMap = new Map();

let selectedSeats = new Set(); // Store seat IDs (database IDs)
let hasUnsavedChanges = false;
let currentAction = null; // 'hold' or 'kill'

// Helper to get hold color from name
function getHoldColor(holdName) {
  const colors = {
    'Red': '#FF0000',
    'Green': '#00FF00',
    'Blue': '#0000FF',
    'Orange': '#FFA500',
  };
  return colors[holdName] || null;
}

// Helper to lighten a color using opacity (for backgrounds)
function lightenColorWithOpacity(hexColor, opacity = 0.3) {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  // Apply opacity by blending with white (255, 255, 255)
  const lightR = Math.round(r * opacity + 255 * (1 - opacity));
  const lightG = Math.round(g * opacity + 255 * (1 - opacity));
  const lightB = Math.round(b * opacity + 255 * (1 - opacity));
  return `rgb(${lightR}, ${lightG}, ${lightB})`;
}

// Helper to darken a color
function darkenColor(hexColor, factor = 0.6) {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  // Darken by multiplying by factor
  const darkR = Math.round(r * factor);
  const darkG = Math.round(g * factor);
  const darkB = Math.round(b * factor);
  return `rgb(${darkR}, ${darkG}, ${darkB})`;
}

// Helper to get hold name from color
function getHoldNameFromColor(color) {
  if (!color) return null;
  const colorLower = color.toLowerCase();
  const colorMap = {
    '#ff0000': 'Red',
    'rgb(255, 0, 0)': 'Red',
    '#00ff00': 'Green',
    'rgb(0, 255, 0)': 'Green',
    '#0000ff': 'Blue',
    'rgb(0, 0, 255)': 'Blue',
    '#ffa500': 'Orange',
    'rgb(255, 165, 0)': 'Orange',
  };
  return colorMap[colorLower] || null;
}

// Helper to get seat state from seat object
function getSeatState(seat) {
  if (seat.seatsIoStatus === 'killed') return 'Killed';
  if (seat.seatsIoStatus === 'resale') return 'Resale Listed';
  if (seat.seatsIoStatus === 'reserved_by_token') return 'In Cart';
  if (seat.seatsIoStatus === 'booked') {
    if (seat.isReservation) return 'Reserved';
    if (seat.isResale) return 'Resold';
    return 'Sold';
  }
  return 'Open';
}

function createSeatElement(seat, eventId) {
  const seatEl = document.createElement('div');
  seatEl.className = 'seat';
  seatEl.dataset.seatId = seat.id;
  seatEl.dataset.eventId = eventId;
  seatEl.dataset.ticketType = seat.ticketType;
  seatEl.dataset.section = seat.section;
  seatEl.dataset.row = seat.row;
  seatEl.dataset.seat = seat.seat;
  
  // Store element in map
  seatElementMap.set(seat.id, seatEl);
  
  // Base styling - default gray circle with darker gray border for all seats
  seatEl.style.width = '30px';
  seatEl.style.height = '30px';
  seatEl.style.margin = '0';
  seatEl.style.borderRadius = '50%';
  seatEl.style.boxSizing = 'border-box';
  seatEl.style.cursor = 'pointer';
  seatEl.style.userSelect = 'none';
  seatEl.style.position = 'relative';
  seatEl.style.display = 'block'; // Ensure seat is visible
  seatEl.style.backgroundColor = '#d1d5da'; // Light gray background
  seatEl.style.border = '2px solid #6b7280'; // Darker gray border
  
  // Apply seat state
  updateSeatElementState(seatEl, seat);
  
  // Add click handler
  seatEl.addEventListener('click', (e) => {
      if (isSelecting) return;
    toggleSeatSelection(seatEl);
    if (eventId === 'season') {
      document.getElementById('selection-ui').classList.remove('hidden');
  } else {
      document.getElementById('selection-ui').classList.add('hidden');
    }
      e.stopPropagation();
      updateAvailableSeatsTable();
    });
  
  return seatEl;
}

function updateSeatElementState(seatEl, seat) {
  // Remove existing symbols
  const existingSparkle = seatEl.querySelector('.not-for-sale-sparkle');
  if (existingSparkle) existingSparkle.remove();
  const existingKill = seatEl.querySelector('.kill-mark');
  if (existingKill) existingKill.remove();
  const existingStateSymbol = seatEl.querySelector('.state-symbol');
  if (existingStateSymbol) existingStateSymbol.remove();
  
  // Determine hold type and color (check direct hold first, then indirect hold)
  let holdColor = null;
  let isIndirectHold = false;
  
  if (seat.directHoldName) {
    // Direct hold - full color theming
    holdColor = getHoldColor(seat.directHoldName);
    isIndirectHold = false;
  } else {
    // Check for indirect holds
    const indirectHold = seat.indirectHolds && seat.indirectHolds.length > 0 ? seat.indirectHolds[0] : null;
    if (indirectHold) {
      holdColor = getHoldColor(indirectHold.holdName);
      isIndirectHold = true;
    }
  }
  
  // Check if seat has a kill and get kill color
  const hasDirectKill = !!seat.killName;
  const hasIndirectKill = seat.indirectKills && seat.indirectKills.length > 0;
  const hasKill = hasDirectKill || hasIndirectKill;
  const killColor = seat.killName 
    ? getHoldColor(seat.killName) 
    : (hasIndirectKill ? getHoldColor(seat.indirectKills[0].killName) : null);
  
  // Check for indirect states (propagated states)
  const hasIndirectState = seat.indirectStates && seat.indirectStates.length > 0;
  const indirectState = hasIndirectState ? seat.indirectStates[0].state : null;
  
  // Determine actual seat state (check indirect state if no direct state)
  const actualState = seat.seatsIoStatus === 'free' && indirectState ? indirectState : seat.seatsIoStatus;
  const seatState = getSeatState({
    ...seat,
    seatsIoStatus: actualState
  });
  
  // Symbol priority: Kill (X) > State symbol (dot/refresh) > Not For Sale (sparkle)
  // Priority logic: If killed, show kill. Else if has state symbol, show state. Else if not-for-sale, show sparkle.
  const showKill = hasKill;
  const showStateSymbol = !hasKill && (seatState === 'In Cart' || seatState === 'Sold' || seatState === 'Reserved' || seatState === 'Resold' || seatState === 'Resale Listed');
  const showNotForSale = !hasKill && !showStateSymbol && seat.notForSale;
  
  // Apply styling - direct kill color themes the seat, indirect kill only colors the symbol (keeps gray background)
  if (hasDirectKill && killColor) {
    // Has direct kill - theme entire seat with kill color (like not-for-sale with hold)
    if (seat.notForSale) {
      seatEl.style.backgroundColor = lightenColorWithOpacity(killColor, 0.3);
      seatEl.style.border = 'none';
    } else {
      seatEl.style.backgroundColor = lightenColorWithOpacity(killColor, 0.3);
      seatEl.style.border = 'none';
    }
  } else if (holdColor && !hasDirectKill) {
    // Has hold but no kill
    if (isIndirectHold) {
      // Indirect hold - use dotted border, keep default background
      if (seat.notForSale) {
        seatEl.style.backgroundColor = '#f3f4f6'; // Lighter gray for not-for-sale
        seatEl.style.border = `2px dotted ${holdColor}`;
      } else {
        seatEl.style.backgroundColor = '#d1d5da'; // Default gray
        seatEl.style.border = `2px dotted ${holdColor}`;
      }
    } else {
      // Direct hold - full color theming
      if (seat.notForSale || showStateSymbol) {
        // Not-for-sale or state seat with direct hold - use lighter version of hold color for background
        seatEl.style.backgroundColor = lightenColorWithOpacity(holdColor, 0.3);
        seatEl.style.border = 'none'; // No border for not-for-sale or state seats
      } else {
        // For-sale seat with direct hold - use full hold color
        seatEl.style.backgroundColor = holdColor;
        seatEl.style.border = `2px solid ${holdColor}`;
      }
    }
  } else {
    // No hold, no kill - use default gray styling
    if (seat.notForSale || showStateSymbol) {
      seatEl.style.backgroundColor = '#f3f4f6'; // Lighter gray for not-for-sale or state seats
      seatEl.style.border = 'none'; // No border
    } else {
      seatEl.style.backgroundColor = '#d1d5da'; // Default gray
      seatEl.style.border = '2px solid #6b7280'; // Darker gray border
    }
  }
  
  // Apply kill mark (X symbol in darker kill color) - Priority 1
  if (showKill && killColor) {
    if (hasDirectKill) {
      const killMark = document.createElement('div');
      killMark.className = 'kill-mark direct-kill';
      killMark.textContent = 'X';
      killMark.style.color = darkenColor(killColor, 0.6); // Darker version of kill color
      killMark.style.position = 'absolute';
      killMark.style.top = '50%';
      killMark.style.left = '50%';
      killMark.style.transform = 'translate(-50%, -50%)';
      killMark.style.fontSize = '16px';
      killMark.style.fontWeight = 'bold';
      killMark.style.pointerEvents = 'none';
      killMark.style.zIndex = '30'; // Highest priority
      seatEl.appendChild(killMark);
    } else if (hasIndirectKill) {
      // Indirect kill - only color the symbol, keep gray background
      const killMark = document.createElement('div');
      killMark.className = 'kill-mark indirect-kill';
      killMark.textContent = 'x';
      killMark.style.color = darkenColor(killColor, 0.6); // Darker version of kill color
      killMark.style.position = 'absolute';
      killMark.style.top = '50%';
      killMark.style.left = '50%';
      killMark.style.transform = 'translate(-50%, -50%)';
      killMark.style.fontSize = '16px';
      killMark.style.fontWeight = 'bold';
      killMark.style.pointerEvents = 'none';
      killMark.style.zIndex = '30'; // Highest priority
      seatEl.appendChild(killMark);
    }
  }
  // Apply state symbol (dot or refresh) - Priority 2
  else if (showStateSymbol) {
    const stateSymbol = document.createElement('div');
    stateSymbol.className = 'state-symbol';
    
    if (seatState === 'Resale Listed') {
      // Refresh icon for resale listed
      stateSymbol.textContent = '↻'; // Unicode refresh symbol
    } else {
      // Dot for In Cart, Sold, Reserved, Resold
      stateSymbol.textContent = '•'; // Bullet point
    }
    
    stateSymbol.style.position = 'absolute';
    stateSymbol.style.top = '50%';
    stateSymbol.style.left = '50%';
    stateSymbol.style.transform = 'translate(-50%, -50%)';
    stateSymbol.style.fontSize = '16px';
    stateSymbol.style.pointerEvents = 'none';
    stateSymbol.style.zIndex = '20'; // Below kill, above sparkle
    
    // Use darker version of hold color for symbol if direct hold, otherwise light gray
    if (holdColor && !isIndirectHold) {
      stateSymbol.style.color = darkenColor(holdColor, 0.6);
    } else {
      stateSymbol.style.color = '#9ca3af'; // Light gray for indirect holds or no holds
    }
    
    stateSymbol.style.lineHeight = '1';
    seatEl.appendChild(stateSymbol);
  }
  // Apply sparkle symbol for not-for-sale seats - Priority 3
  else if (showNotForSale) {
    const sparkle = document.createElement('div');
    sparkle.className = 'not-for-sale-sparkle';
    sparkle.textContent = '✧'; // 4-point star/sparkle character
    sparkle.style.position = 'absolute';
    sparkle.style.top = '50%';
    sparkle.style.left = '50%';
    sparkle.style.transform = 'translate(-50%, -50%)';
    sparkle.style.fontSize = '16px';
    // Use darker version of hold color for sparkle if direct hold, otherwise light gray
    if (holdColor && !isIndirectHold) {
      sparkle.style.color = darkenColor(holdColor, 0.6);
    } else {
      sparkle.style.color = '#9ca3af'; // Light gray for indirect holds or no holds
    }
    sparkle.style.pointerEvents = 'none';
    sparkle.style.zIndex = '10'; // Lowest priority
    sparkle.style.lineHeight = '1';
    seatEl.appendChild(sparkle);
  }
}

function renderSectionMap(container, eventId, seats) {
  if (!container) {
    console.error('Container is null for eventId:', eventId);
    return;
  }
  
  if (!seats || seats.length === 0) {
    console.warn(`No seats provided for eventId: ${eventId}`);
    container.innerHTML = '<p>No seats found</p>';
    return;
  }
  
    container.innerHTML = '';

  // Create a 2x2 grid container for sections
  const sectionsGrid = document.createElement('div');
  sectionsGrid.className = 'sections-grid';
  sectionsGrid.style.display = 'grid';
  sectionsGrid.style.gridTemplateColumns = '1fr 1fr';
  sectionsGrid.style.gridTemplateRows = '1fr 1fr';
  sectionsGrid.style.gap = '24px';
  sectionsGrid.style.width = '100%';
  
  // Sort sections in 2x2 order: 101, 102 (top row), 103, 104 (bottom row)
  const sectionsOrder = ['101', '102', '103', '104'];
  const rows = ['A', 'B', 'C', 'D', 'E'];
  
  let seatsRendered = 0;
  
  // Create section containers
  sectionsOrder.forEach((section, sectionIdx) => {
    // Create section wrapper
    const sectionWrapper = document.createElement('div');
    sectionWrapper.className = 'section-wrapper';
    
    // Section header
    const sectionHeader = document.createElement('div');
    sectionHeader.style.textAlign = 'center';
    sectionHeader.style.marginBottom = '8px';
    sectionHeader.style.fontWeight = '500';
    sectionHeader.textContent = `Section ${section}`;
    sectionWrapper.appendChild(sectionHeader);
    
    // Create grid for this section
    const grid = document.createElement('div');
    grid.className = 'seat-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `30px repeat(5, 30px)`;
    grid.style.gridTemplateRows = `30px repeat(5, 30px)`;
    grid.style.gap = '5px';

    // Top-left empty cell
    const emptyCell = document.createElement('div');
    emptyCell.style.gridRow = '1';
    emptyCell.style.gridColumn = '1';
    grid.appendChild(emptyCell);

    // Column labels (1-5)
    for (let col = 1; col <= 5; col++) {
      const colLabel = document.createElement('div');
      colLabel.textContent = col.toString();
      colLabel.style.textAlign = 'center';
      colLabel.style.fontWeight = '400';
      colLabel.style.fontSize = '13px';
      colLabel.style.lineHeight = '30px';
      colLabel.style.gridRow = '1';
      colLabel.style.gridColumn = `${col + 1}`;
      grid.appendChild(colLabel);
    }

    // Row labels and seats
    rows.forEach((rowLabel, rowIdx) => {
      // Row label
      const rowLabelEl = document.createElement('div');
      rowLabelEl.textContent = rowLabel;
      rowLabelEl.style.textAlign = 'right';
      rowLabelEl.style.fontWeight = '400';
      rowLabelEl.style.fontSize = '13px';
      rowLabelEl.style.lineHeight = '30px';
      rowLabelEl.style.gridRow = `${rowIdx + 2}`;
      rowLabelEl.style.gridColumn = '1';
      grid.appendChild(rowLabelEl);
      
      // Seats for this row
      for (let seatNum = 1; seatNum <= 5; seatNum++) {
        const seat = seats.find(s => s.section === section && s.row === rowLabel && s.seat === seatNum);
        if (seat) {
          const seatEl = createSeatElement(seat, eventId);
          if (!seatEl) {
            console.error('Failed to create seat element for seat:', seat);
            continue;
          }
          seatEl.style.gridRow = `${rowIdx + 2}`;
          seatEl.style.gridColumn = `${seatNum + 1}`;
          grid.appendChild(seatEl);
          seatsRendered++;
        }
      }
    });
    
    sectionWrapper.appendChild(grid);
    sectionsGrid.appendChild(sectionWrapper);
  });
  
    container.appendChild(sectionsGrid);
    console.log(`Rendered ${seatsRendered} seats for ${eventId} in ${sectionsOrder.length} sections`);
}

async function renderMaps() {
  // Load seat data for all events
  for (const eventId of seatMaps) {
    try {
      const seats = await window.seatAPI.fetchSeatsForEvent(eventId);
      console.log(`Loaded ${seats.length} seats for ${eventId}`, seats.slice(0, 2)); // Debug: log first 2 seats
      const container = document.getElementById(eventId);
      if (!container) {
        console.error(`Container not found for eventId: ${eventId}`);
        continue;
      }
      
      // Store seat data
      if (!seatDataByEvent[eventId]) seatDataByEvent[eventId] = {};
      seats.forEach(seat => {
        const key = `${seat.ticketType}-${seat.section}-${seat.row}-${seat.seat}`;
        seatDataByEvent[eventId][key] = seat;
      });
      
      // Render the map
      renderSectionMap(container, eventId, seats);
      console.log(`Rendered map for ${eventId}, container children:`, container.children.length);
    } catch (error) {
      console.error(`Error loading seats for ${eventId}:`, error);
    }
  }
  
  updateAvailableSeatsTable();
}

async function reloadSeatData(eventId) {
  try {
    const seats = await window.seatAPI.fetchSeatsForEvent(eventId);
    if (!seatDataByEvent[eventId]) seatDataByEvent[eventId] = {};
    seats.forEach(seat => {
      const key = `${seat.ticketType}-${seat.section}-${seat.row}-${seat.seat}`;
      seatDataByEvent[eventId][key] = seat;
      
      // Update existing seat element if it exists
      const seatEl = seatElementMap.get(seat.id);
      if (seatEl) {
        updateSeatElementState(seatEl, seat);
        // Clear selected class when reloading
        seatEl.classList.remove('selected');
      }
    });
  } catch (error) {
    console.error(`Error reloading seats for ${eventId}:`, error);
  }
}

function toggleSeatSelection(seatEl) {
  const seatId = parseInt(seatEl.dataset.seatId);
  seatEl.classList.toggle('selected');
  if (selectedSeats.has(seatId)) {
    selectedSeats.delete(seatId);
  } else {
    selectedSeats.add(seatId);
  }
  updateSelectionUI();
  updateButtonStates();
}

function clearSelection() {
  // Remove selected class from all seat elements
  document.querySelectorAll('.seat.selected').forEach(seat => seat.classList.remove('selected'));
  // Clear the selected seats Set
  selectedSeats.clear();
  hasUnsavedChanges = false;
  updateSaveButton();
  updateAvailableSeatsTable();
  updateSelectionUI();
  updateButtonStates();
  
  // Ensure selection UI is hidden
  const selectionUI = document.getElementById('selection-ui');
  if (selectionUI) {
    selectionUI.classList.add('hidden');
  }
}

async function saveSelection() {
  const allMaps = ['packageA', 'packageB', 'event1', 'event2', 'event3'];
  const updates = [];
  
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) return;
    
    const selectedEventId = seatEl.dataset.eventId;
    if (selectedEventId !== 'season') return;
    
    // Get seat data
    const ticketType = seatEl.dataset.ticketType;
    const section = seatEl.dataset.section;
    const row = seatEl.dataset.row;
    const seatNum = seatEl.dataset.seat;
    
    allMaps.forEach(mapId => {
      const checkbox = document.getElementById(`pkg-${mapId}`) || document.getElementById(`evt-${mapId}`);
      if (!checkbox) return;
      
      // Find matching seat in this map
      const key = `${ticketType}-${section}-${row}-${seatNum}`;
      const seatData = seatDataByEvent[mapId]?.[key];
      if (seatData) {
        // Skip seats that are in restricted states (Sold, Resold, Reserved, In Cart, Resale Listed)
        const state = getSeatState(seatData);
        const restrictedStates = ['Sold', 'Resold', 'Reserved', 'In Cart', 'Resale Listed'];
        if (restrictedStates.includes(state)) {
          return; // Skip this seat
        }
        
        updates.push({
          id: seatData.id,
          notForSale: !checkbox.checked,
        });
      }
    });
  });
  
  if (updates.length > 0) {
    await window.seatAPI.batchUpdateSeats(updates);
    // Reload all affected events
    for (const mapId of allMaps) {
      await reloadSeatData(mapId);
    }
  }
  
  hasUnsavedChanges = false;
  updateSaveButton();
  updateAvailableSeatsTable();
  clearSelection();
}

async function releaseHold() {
  const promises = [];
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) return;
    
    // Only release if it has a direct hold (solid border)
    const hasDirectHold = seatEl.style.borderStyle === 'solid' && 
                         seatEl.style.borderColor && 
                         seatEl.style.borderColor !== 'transparent';
    
    if (hasDirectHold) {
      promises.push(window.seatAPI.removeDirectHold(seatId));
    }
  });
  
  await Promise.all(promises);
  
  // Reload affected events
  const affectedEvents = new Set();
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl) affectedEvents.add(seatEl.dataset.eventId);
  });
  
  for (const eventId of affectedEvents) {
    await reloadSeatData(eventId);
    // Also reload related events
    const related = getRelatedEvents(eventId);
    for (const relEventId of related) {
      await reloadSeatData(relEventId);
    }
  }

  clearSelection();
  updateAvailableSeatsTable();
}

async function releaseKill() {
  const promises = [];
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) return;
    
    // Only release if it has a direct kill
    const hasDirectKill = seatEl.querySelector('.kill-mark.direct-kill');
    if (hasDirectKill) {
      promises.push(window.seatAPI.removeDirectKill(seatId));
    }
  });
  
  await Promise.all(promises);
  
  // Reload affected events
  const affectedEvents = new Set();
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl) affectedEvents.add(seatEl.dataset.eventId);
  });
  
  for (const eventId of affectedEvents) {
    await reloadSeatData(eventId);
    const related = getRelatedEvents(eventId);
    for (const relEventId of related) {
      await reloadSeatData(relEventId);
    }
  }

  clearSelection();
  updateAvailableSeatsTable();
}

function getRelatedEvents(eventId) {
  const related = new Set();
  if (parentMaps[eventId]) {
    parentMaps[eventId].forEach(child => related.add(child));
      Object.keys(parentMaps).forEach(otherParent => {
      if (otherParent !== eventId) {
        parentMaps[eventId].forEach(child => {
          if (parentMaps[otherParent]?.includes(child)) {
            related.add(otherParent);
          }
        });
        }
      });
    }
  if (childMaps[eventId]) {
    childMaps[eventId].forEach(parent => related.add(parent));
    childMaps[eventId].forEach(parent => {
      if (parentMaps[parent]) {
        parentMaps[parent].forEach(sibling => {
          if (sibling !== eventId) related.add(sibling);
      });
    }
  });
  }
  return Array.from(related);
}

async function applyHoldToSelectedSeats(color) {
  const holdName = getHoldNameFromColor(color);
  if (!holdName) return;
  
  const promises = [];
  selectedSeats.forEach(seatId => {
    promises.push(window.seatAPI.applyDirectHold(seatId, holdName));
  });
  
  await Promise.all(promises);
  
  // Reload affected events
  const affectedEvents = new Set();
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl) affectedEvents.add(seatEl.dataset.eventId);
  });
  
  for (const eventId of affectedEvents) {
    await reloadSeatData(eventId);
    const related = getRelatedEvents(eventId);
    for (const relEventId of related) {
      await reloadSeatData(relEventId);
    }
  }

  clearSelection();
  document.getElementById('palette').classList.add('hidden');
  updateAvailableSeatsTable();
}

async function applyKillToSelectedSeats(color) {
  const killName = getHoldNameFromColor(color);
  if (!killName) return;
  
  const promises = [];
  selectedSeats.forEach(seatId => {
    promises.push(window.seatAPI.applyDirectKill(seatId, killName));
  });
  
  await Promise.all(promises);
  
  // Reload affected events
  const affectedEvents = new Set();
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl) affectedEvents.add(seatEl.dataset.eventId);
  });
  
  for (const eventId of affectedEvents) {
    await reloadSeatData(eventId);
    const related = getRelatedEvents(eventId);
    for (const relEventId of related) {
      await reloadSeatData(relEventId);
    }
  }

  clearSelection();
  document.getElementById('palette').classList.add('hidden');
  updateAvailableSeatsTable();
}

async function addToCartSelectedSeats() {
  const promises = [];
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) return;
    
    // Get seat data to check restrictions
    const eventId = seatEl.dataset.eventId;
    const ticketType = seatEl.dataset.ticketType;
    const section = seatEl.dataset.section;
    const row = seatEl.dataset.row;
    const seatNum = seatEl.dataset.seat;
    const key = `${ticketType}-${section}-${row}-${seatNum}`;
    const seatData = seatDataByEvent[eventId]?.[key];
    
    // Skip if notForSale
    if (seatData && seatData.notForSale) return;
    
    promises.push(window.seatAPI.addToCart(seatId));
  });
  
  if (promises.length === 0) return;
  
  await Promise.all(promises);
  
  // Reload affected events
  const affectedEvents = new Set();
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl) affectedEvents.add(seatEl.dataset.eventId);
  });
  
  for (const eventId of affectedEvents) {
    await reloadSeatData(eventId);
    const related = getRelatedEvents(eventId);
    for (const relEventId of related) {
      await reloadSeatData(relEventId);
    }
  }
  
  clearSelection();
  updateAvailableSeatsTable();
  updateButtonStates();
}

async function sellSelectedSeats() {
  const promises = [];
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) return;
    
    // Get seat data to check restrictions
    const eventId = seatEl.dataset.eventId;
    const ticketType = seatEl.dataset.ticketType;
    const section = seatEl.dataset.section;
    const row = seatEl.dataset.row;
    const seatNum = seatEl.dataset.seat;
    const key = `${ticketType}-${section}-${row}-${seatNum}`;
    const seatData = seatDataByEvent[eventId]?.[key];
    
    // Skip if notForSale
    if (seatData && seatData.notForSale) return;
    
    promises.push(window.seatAPI.sellSeat(seatId));
  });
  
  if (promises.length === 0) return;
  
  await Promise.all(promises);
  
  // Reload affected events
  const affectedEvents = new Set();
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl) affectedEvents.add(seatEl.dataset.eventId);
  });
  
  for (const eventId of affectedEvents) {
    await reloadSeatData(eventId);
    const related = getRelatedEvents(eventId);
    for (const relEventId of related) {
      await reloadSeatData(relEventId);
    }
  }

  clearSelection();
  updateAvailableSeatsTable();
  updateButtonStates();
}

async function reserveSelectedSeats() {
  const promises = [];
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) return;
    
    // Get seat data to check restrictions
    const eventId = seatEl.dataset.eventId;
    const ticketType = seatEl.dataset.ticketType;
    const section = seatEl.dataset.section;
    const row = seatEl.dataset.row;
    const seatNum = seatEl.dataset.seat;
    const key = `${ticketType}-${section}-${row}-${seatNum}`;
    const seatData = seatDataByEvent[eventId]?.[key];
    
    // Skip if notForSale
    if (seatData && seatData.notForSale) return;
    
    promises.push(window.seatAPI.reserveSeat(seatId));
  });
  
  if (promises.length === 0) return;
  
  await Promise.all(promises);
  
  // Reload affected events
  const affectedEvents = new Set();
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl) affectedEvents.add(seatEl.dataset.eventId);
  });
  
  for (const eventId of affectedEvents) {
    await reloadSeatData(eventId);
    const related = getRelatedEvents(eventId);
    for (const relEventId of related) {
      await reloadSeatData(relEventId);
    }
  }

  clearSelection();
  updateAvailableSeatsTable();
  updateButtonStates();
}

async function listSelectedSeats() {
  // Validate: all selected seats must be in Sold state
  let allSold = true;
  for (const seatId of selectedSeats) {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) continue;
    
    const eventId = seatEl.dataset.eventId;
    const ticketType = seatEl.dataset.ticketType;
    const section = seatEl.dataset.section;
    const row = seatEl.dataset.row;
    const seatNum = seatEl.dataset.seat;
    const key = `${ticketType}-${section}-${row}-${seatNum}`;
    const seatData = seatDataByEvent[eventId]?.[key];
    
    if (!seatData) continue;
    
    const state = getSeatState(seatData);
    if (state !== 'Sold' || seatData.notForSale) {
      allSold = false;
      break;
    }
  }
  
  if (!allSold) {
    alert('Can only list seats that are in Sold state and not marked as "Not For Sale"');
    return;
  }
  
  const promises = [];
  selectedSeats.forEach(seatId => {
    promises.push(window.seatAPI.listSeat(seatId));
  });
  
  await Promise.all(promises);
  
  // Reload affected events (no propagation for List)
  const affectedEvents = new Set();
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl) affectedEvents.add(seatEl.dataset.eventId);
  });
  
  for (const eventId of affectedEvents) {
    await reloadSeatData(eventId);
  }
  
  clearSelection();
  updateAvailableSeatsTable();
  updateButtonStates();
}

async function resellSelectedSeats() {
  // Validate: all selected seats must be in Resale Listed state
  let allResaleListed = true;
  for (const seatId of selectedSeats) {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) continue;
    
    const eventId = seatEl.dataset.eventId;
    const ticketType = seatEl.dataset.ticketType;
    const section = seatEl.dataset.section;
    const row = seatEl.dataset.row;
    const seatNum = seatEl.dataset.seat;
    const key = `${ticketType}-${section}-${row}-${seatNum}`;
    const seatData = seatDataByEvent[eventId]?.[key];
    
    if (!seatData) continue;
    
    const state = getSeatState(seatData);
    if (state !== 'Resale Listed' || seatData.notForSale) {
      allResaleListed = false;
      break;
    }
  }
  
  if (!allResaleListed) {
    alert('Can only resell seats that are in Resale Listed state and not marked as "Not For Sale"');
    return;
  }
  
  const promises = [];
  selectedSeats.forEach(seatId => {
    promises.push(window.seatAPI.resellSeat(seatId));
  });
  
  await Promise.all(promises);
  
  // Reload affected events (no propagation for Resell)
  const affectedEvents = new Set();
  selectedSeats.forEach(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl) affectedEvents.add(seatEl.dataset.eventId);
  });
  
  for (const eventId of affectedEvents) {
    await reloadSeatData(eventId);
  }

  clearSelection();
  updateAvailableSeatsTable();
  updateButtonStates();
}

function updateButtonStates() {
  if (selectedSeats.size === 0) {
    // Disable all action buttons when no seats selected
    const buttons = ['add-to-cart', 'sell', 'reserve', 'list', 'resell', 'kill'];
    buttons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) btn.disabled = true;
    });
    return;
  }
  
  // Check states of all selected seats
  let allSold = true;
  let allResaleListed = true;
  let anyNotForSale = false;
  let anyResaleListed = false;
  let anyRestrictedForReserve = false; // Sold, In Cart, Resold, Killed, or Resale Listed
  
  for (const seatId of selectedSeats) {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) continue;
    
    const eventId = seatEl.dataset.eventId;
    const ticketType = seatEl.dataset.ticketType;
    const section = seatEl.dataset.section;
    const row = seatEl.dataset.row;
    const seatNum = seatEl.dataset.seat;
    const key = `${ticketType}-${section}-${row}-${seatNum}`;
    const seatData = seatDataByEvent[eventId]?.[key];
    
    if (!seatData) continue;
    
    const state = getSeatState(seatData);
    
    if (state !== 'Sold' || seatData.notForSale) allSold = false;
    if (state !== 'Resale Listed' || seatData.notForSale) allResaleListed = false;
    if (seatData.notForSale) anyNotForSale = true;
    if (state === 'Resale Listed') anyResaleListed = true;
    
    // Check if seat is in a state that restricts Reserve
    if (state === 'Sold' || state === 'In Cart' || state === 'Resold' || state === 'Killed' || state === 'Resale Listed') {
      anyRestrictedForReserve = true;
    }
  }
  
  // Update button states
  const addToCartBtn = document.getElementById('add-to-cart');
  const sellBtn = document.getElementById('sell');
  const reserveBtn = document.getElementById('reserve');
  const listBtn = document.getElementById('list');
  const resellBtn = document.getElementById('resell');
  const killBtn = document.getElementById('kill');
  
  // Disable Add to Cart and Sell if any seat is Not For Sale or in a restricted state (Sold, In Cart, Resold, Killed, Resale Listed)
  if (addToCartBtn) addToCartBtn.disabled = anyNotForSale || anyRestrictedForReserve;
  if (sellBtn) sellBtn.disabled = anyNotForSale || anyRestrictedForReserve;
  // Disable Reserve if any seat is Not For Sale or in a restricted state (Sold, In Cart, Resold, Killed, Resale Listed)
  if (reserveBtn) reserveBtn.disabled = anyNotForSale || anyRestrictedForReserve;
  if (listBtn) listBtn.disabled = !allSold;
  if (resellBtn) resellBtn.disabled = !allResaleListed;
  // Disable Kill if any seat is Not For Sale or Resale Listed
  if (killBtn) killBtn.disabled = anyNotForSale || anyResaleListed;
}

async function resetAll() {
  await window.seatAPI.resetAllSeats();
  
  // Reload all events
  for (const eventId of seatMaps) {
    await reloadSeatData(eventId);
  }
  
  clearSelection();
}

// --- Selection UI ---
function updateSelectionUI() {
  const selectionUI = document.getElementById('selection-ui');
  const selectionCount = document.getElementById('selection-count');
  const selectionDetails = document.getElementById('selection-details');
  
  if (selectedSeats.size === 0) {
    selectionUI.classList.add('hidden');
    return;
  }
  
  let hasSeasonSeat = false;
  for (const seatId of selectedSeats) {
    const seatEl = seatElementMap.get(seatId);
    if (seatEl && seatEl.dataset.eventId === 'season') {
      hasSeasonSeat = true;
      break;
    }
  }
  
  if (hasSeasonSeat) {
    selectionUI.classList.remove('hidden');
  }
  
  selectionCount.textContent = `${selectedSeats.size} seat${selectedSeats.size === 1 ? '' : 's'} selected`;
  
  // Get selected seat details
  const seatDetails = Array.from(selectedSeats).map(seatId => {
    const seatEl = seatElementMap.get(seatId);
    if (!seatEl) return '';
    const eventId = seatEl.dataset.eventId;
    const ticketType = seatEl.dataset.ticketType;
    const section = seatEl.dataset.section;
    const row = seatEl.dataset.row;
    const seat = seatEl.dataset.seat;
    return `${eventId}: ${ticketType} ${section} ${row}${seat}`;
  }).filter(Boolean);
  
  selectionDetails.textContent = seatDetails.join(', ');
  
  updateAvailabilityCheckboxes();
  addCheckboxEventListeners();
}

function addCheckboxEventListeners() {
  const allMaps = ['packageA', 'packageB', 'event1', 'event2', 'event3'];
  allMaps.forEach(mapId => {
    const checkbox = document.getElementById(`pkg-${mapId}`) || document.getElementById(`evt-${mapId}`);
    if (checkbox) {
      checkbox.removeEventListener('change', handleCheckboxChange);
      checkbox.addEventListener('change', handleCheckboxChange);
    }
  });
}

function handleCheckboxChange(event) {
  hasUnsavedChanges = true;
  updateSaveButton();
  // Update counts but don't override the checkbox state - user's manual change should be preserved
  updateAvailabilityCheckboxes(event.target);
}

function updateSaveButton() {
  const saveBtn = document.getElementById('save-selection');
  if (hasUnsavedChanges) {
    saveBtn.classList.remove('hidden');
  } else {
    saveBtn.classList.add('hidden');
  }
}

function updateAvailabilityCheckboxes(changedCheckbox = null) {
  const allMaps = ['packageA', 'packageB', 'event1', 'event2', 'event3'];
  
  allMaps.forEach(mapId => {
    const checkbox = document.getElementById(`pkg-${mapId}`) || document.getElementById(`evt-${mapId}`);
    const countElement = document.getElementById(`count-${mapId}`);
    const checkboxItem = checkbox?.closest('.checkbox-item');
    
    if (!checkbox || !countElement) return;
    
    // If this checkbox was just manually changed, don't override its state
    if (changedCheckbox && checkbox === changedCheckbox) {
      // Only update the count and visual state, not the checked state
      let available = 0;
      let total = 0;
      
      selectedSeats.forEach(seatId => {
        const seatEl = seatElementMap.get(seatId);
        if (!seatEl || seatEl.dataset.eventId !== 'season') return;
        
        total++;
        const ticketType = seatEl.dataset.ticketType;
        const section = seatEl.dataset.section;
        const row = seatEl.dataset.row;
        const seatNum = seatEl.dataset.seat;
        const key = `${ticketType}-${section}-${row}-${seatNum}`;
        const seatData = seatDataByEvent[mapId]?.[key];
        
        if (seatData && !seatData.notForSale) {
          available++;
        }
      });
      
      countElement.textContent = `(${available}/${total})`;
      
      // Update visual state based on user's choice
      if (checkbox.checked) {
        checkboxItem?.classList.remove('mixed-state');
      } else {
        checkboxItem?.classList.remove('mixed-state');
      }
      return;
    }
    
    // For other checkboxes, calculate state from database
  let available = 0;
    let total = 0;
    
    selectedSeats.forEach(seatId => {
      const seatEl = seatElementMap.get(seatId);
      if (!seatEl || seatEl.dataset.eventId !== 'season') return;
      
      total++;
      const ticketType = seatEl.dataset.ticketType;
      const section = seatEl.dataset.section;
      const row = seatEl.dataset.row;
      const seatNum = seatEl.dataset.seat;
      const key = `${ticketType}-${section}-${row}-${seatNum}`;
      const seatData = seatDataByEvent[mapId]?.[key];
      
      if (seatData && !seatData.notForSale) {
      available++;
    }
  });
  
    countElement.textContent = `(${available}/${total})`;
    
    if (available === total && total > 0) {
      checkbox.checked = true;
      checkbox.indeterminate = false;
      checkboxItem?.classList.remove('mixed-state');
    } else if (available === 0) {
      checkbox.checked = false;
      checkbox.indeterminate = false;
      checkboxItem?.classList.remove('mixed-state');
    } else {
      checkbox.checked = true;
      checkbox.indeterminate = false;
      checkboxItem?.classList.add('mixed-state');
    }
  });
}

// --- Available seats table ---
async function updateAvailableSeatsTable() {
  const tableContainer = document.getElementById('available-seats-table');
  if (!tableContainer) return;

  const allSeatRows = [];
  
  // Fetch all seat data for non-season events
  for (const mapId of seatMaps) {
    if (mapId === 'season') continue;
    
    try {
      const seats = await window.seatAPI.fetchSeatsForEvent(mapId);
      
      seats.forEach(seat => {
      let hold = '-';
      let holdSource = '';
      let kill = '-';
      let killSource = '';
        const availability = seat.notForSale ? 'Not For Sale' : 'For Sale';
        const state = getSeatState(seat);
      
      // Check for holds
        if (seat.directHoldName) {
          hold = seat.directHoldName;
        } else if (seat.indirectHolds && seat.indirectHolds.length > 0) {
          hold = seat.indirectHolds[0].holdName;
          holdSource = seat.indirectHolds[0].sourceEvent;
      }
      
      // Check for kills
        if (seat.killName) {
          kill = seat.killName;
        } else if (seat.indirectKills && seat.indirectKills.length > 0) {
          kill = seat.indirectKills[0].killName;
          killSource = seat.indirectKills[0].sourceEvent;
        }
        
        // Create a row for each individual seat
        allSeatRows.push({
          map: mapId,
          ticketType: seat.ticketType,
          section: seat.section,
          row: seat.row,
          from: seat.seat,
          to: seat.seat,
          numSeats: 1,
          availability,
          state,
          hold,
          holdSource,
          kill,
          killSource,
    });
  });
    } catch (error) {
      console.error(`Error fetching seats for ${mapId}:`, error);
    }
  }

  // Sort rows by map, ticket type, section, row, and seat number
  allSeatRows.sort((a, b) => {
    if (a.map !== b.map) return a.map.localeCompare(b.map);
    if (a.ticketType !== b.ticketType) return a.ticketType.localeCompare(b.ticketType);
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    if (a.row !== b.row) return a.row.localeCompare(b.row);
    return a.from - b.from;
  });

  if (allSeatRows.length === 0) {
    tableContainer.innerHTML = '<p>No seats found.</p>';
    return;
  }

  let html = '<table style="margin: 20px auto; border-collapse: collapse;"><thead><tr>' +
  '<th style="border:1px solid #ccc;">Event</th>' +
    '<th style="border:1px solid #ccc;">Ticket Type</th>' +
    '<th style="border:1px solid #ccc;">Section</th>' +
  '<th style="border:1px solid #ccc;">Row</th>' +
    '<th style="border:1px solid #ccc;">Seat</th>' +
  '<th style="border:1px solid #ccc;">Num seats</th>' +
    '<th style="border:1px solid #ccc;">Availability</th>' +
    '<th style="border:1px solid #ccc;">State</th>' +
    '<th style="border:1px solid #ccc;">Hold</th>' +
    '<th style="border:1px solid #ccc;">Hold Source</th>' +
    '<th style="border:1px solid #ccc;">Kill</th>' +
    '<th style="border:1px solid #ccc;">Kill Source</th>' +
    '</tr></thead><tbody>';
  
  allSeatRows.forEach(row => {
  const rowColor = row.availability === 'For Sale' ? '#111' : (row.availability === 'Not For Sale' ? 'red' : 'inherit');
  html += `<tr style="color:${rowColor};">
      <td style="border:1px solid #ccc;">${row.map}</td>
      <td style="border:1px solid #ccc;">${row.ticketType}</td>
      <td style="border:1px solid #ccc;">${row.section}</td>
      <td style="border:1px solid #ccc;">${row.row}</td>
      <td style="border:1px solid #ccc;">${row.from}</td>
      <td style="border:1px solid #ccc;">${row.numSeats}</td>
      <td style="border:1px solid #ccc;">${row.availability}</td>
      <td style="border:1px solid #ccc;">${row.state}</td>
      <td style="border:1px solid #ccc;">${row.hold === '-' ? '-' : row.hold}</td>
      <td style="border:1px solid #ccc;">${row.holdSource || ''}</td>
      <td style="border:1px solid #ccc;">${row.kill === '-' ? '-' : row.kill}</td>
      <td style="border:1px solid #ccc;">${row.killSource || ''}</td>
      </tr>`;
  });
  
  html += '</tbody></table>';
  tableContainer.innerHTML = html;
}

// No checkbox listeners needed - showing individual seats

// View toggle functionality
function switchView(viewName) {
  const mapView = document.getElementById('map-view');
  const listView = document.getElementById('list-view');
  const mapViewBtn = document.getElementById('map-view-btn');
  const listViewBtn = document.getElementById('list-view-btn');
  
  if (viewName === 'map') {
    mapView.classList.add('active');
    listView.classList.remove('active');
    mapViewBtn.classList.add('active');
    listViewBtn.classList.remove('active');
  } else if (viewName === 'list') {
    mapView.classList.remove('active');
    listView.classList.add('active');
    mapViewBtn.classList.remove('active');
    listViewBtn.classList.add('active');
    // Update the table when switching to list view
    updateAvailableSeatsTable();
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Set up view toggle buttons
  document.getElementById('map-view-btn').addEventListener('click', () => switchView('map'));
  document.getElementById('list-view-btn').addEventListener('click', () => switchView('list'));
  
  // Set up reset all button (at top)
  document.getElementById('reset-all-btn').addEventListener('click', resetAll);
  
  await renderMaps();

  document.getElementById('palette').classList.add('hidden');
  document.getElementById('hold').addEventListener('click', () => {
    const holdBtn = document.getElementById('hold');
    // Don't allow action if button is disabled or no seats are selected
    if (holdBtn.disabled || selectedSeats.size === 0) {
      return;
    }
    currentAction = 'hold';
    document.getElementById('palette').classList.toggle('hidden');
  });

  document.getElementById('kill').addEventListener('click', () => {
    const killBtn = document.getElementById('kill');
    // Don't allow action if button is disabled or no seats are selected
    if (killBtn.disabled || selectedSeats.size === 0) {
      return;
    }
    currentAction = 'kill';
    document.getElementById('palette').classList.toggle('hidden');
  });

  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      if (currentAction === 'hold') {
        applyHoldToSelectedSeats(color);
      } else if (currentAction === 'kill') {
        applyKillToSelectedSeats(color);
      }
    });
  });

  
  // New action buttons
  document.getElementById('add-to-cart').addEventListener('click', () => {
    const btn = document.getElementById('add-to-cart');
    if (btn.disabled || selectedSeats.size === 0) return;
    addToCartSelectedSeats();
  });
  document.getElementById('sell').addEventListener('click', () => {
    const btn = document.getElementById('sell');
    if (btn.disabled || selectedSeats.size === 0) return;
    sellSelectedSeats();
  });
  document.getElementById('reserve').addEventListener('click', () => {
    const btn = document.getElementById('reserve');
    if (btn.disabled || selectedSeats.size === 0) return;
    reserveSelectedSeats();
  });
  document.getElementById('list').addEventListener('click', () => {
    const btn = document.getElementById('list');
    if (btn.disabled || selectedSeats.size === 0) return;
    listSelectedSeats();
  });
  document.getElementById('resell').addEventListener('click', () => {
    const btn = document.getElementById('resell');
    if (btn.disabled || selectedSeats.size === 0) return;
    resellSelectedSeats();
  });
  
  // Initialize button states
  updateButtonStates();
  
  // Selection UI event listeners
  document.getElementById('clear-selection').addEventListener('click', clearSelection);
  document.getElementById('save-selection').addEventListener('click', saveSelection);

  // Selection drawer: select/deselect all for packages/events
  const selectAllPackagesBtn = document.getElementById('select-all-packages');
  const deselectAllPackagesBtn = document.getElementById('deselect-all-packages');
  if (selectAllPackagesBtn) {
    selectAllPackagesBtn.addEventListener('click', function() {
      ['packageA', 'packageB'].forEach(mapId => {
        const cb = document.getElementById(`pkg-${mapId}`);
        if (cb) cb.checked = true;
      });
      hasUnsavedChanges = true;
      updateSaveButton();
    });
  }
  if (deselectAllPackagesBtn) {
    deselectAllPackagesBtn.addEventListener('click', function() {
      ['packageA', 'packageB'].forEach(mapId => {
        const cb = document.getElementById(`pkg-${mapId}`);
        if (cb) cb.checked = false;
      });
      hasUnsavedChanges = true;
      updateSaveButton();
    });
  }
  
  const selectAllEventsBtn = document.getElementById('select-all-events');
  const deselectAllEventsBtn = document.getElementById('deselect-all-events');
  if (selectAllEventsBtn) {
    selectAllEventsBtn.addEventListener('click', function() {
      ['event1', 'event2', 'event3'].forEach(mapId => {
        const cb = document.getElementById(`evt-${mapId}`);
        if (cb) cb.checked = true;
      });
      hasUnsavedChanges = true;
      updateSaveButton();
    });
  }
  if (deselectAllEventsBtn) {
    deselectAllEventsBtn.addEventListener('click', function() {
      ['event1', 'event2', 'event3'].forEach(mapId => {
        const cb = document.getElementById(`evt-${mapId}`);
        if (cb) cb.checked = false;
      });
      hasUnsavedChanges = true;
      updateSaveButton();
    });
  }
});

// --- Area selection tool ---
let isSelecting = false;
let startX, startY, selectionBox;

function getSeatContainers() {
  return seatMaps.map(id => document.getElementById(id)).filter(Boolean);
}

function onMouseDown(e) {
  if (e.button !== 0) return;
  if (e.target.classList.contains('seat')) return;
  const selectionUI = document.getElementById('selection-ui');
  if (selectionUI && selectionUI.contains(e.target)) return;
  isSelecting = true;
  startX = e.pageX;
  startY = e.pageY;

  selectionBox = document.createElement('div');
  selectionBox.id = 'selection-box';
  selectionBox.style.position = 'absolute';
  selectionBox.style.border = '2px dashed #7279fe';
  selectionBox.style.background = 'rgba(114,121,254,0.1)';
  selectionBox.style.pointerEvents = 'none';
  document.body.appendChild(selectionBox);
  updateSelectionBox(e.pageX, e.pageY);
}

function onMouseMove(e) {
  if (!isSelecting) return;
  updateSelectionBox(e.pageX, e.pageY);
}

function onMouseUp(e) {
  if (!isSelecting) return;
  isSelecting = false;
  selectSeatsInBox();
  if (selectionBox) selectionBox.remove();
  selectionBox = null;
  updateAvailableSeatsTable();
}

function updateSelectionBox(x, y) {
  const left = Math.min(startX, x);
  const top = Math.min(startY, y);
  const width = Math.abs(x - startX);
  const height = Math.abs(y - startY);
  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
}

function selectSeatsInBox() {
  const box = selectionBox.getBoundingClientRect();
  let seasonSelected = false;
  getSeatContainers().forEach(container => {
    container.querySelectorAll('.seat').forEach(seat => {
      const seatRect = seat.getBoundingClientRect();
      if (
        seatRect.left < box.right &&
        seatRect.right > box.left &&
        seatRect.top < box.bottom &&
        seatRect.bottom > box.top
      ) {
        toggleSeatSelection(seat);
        if (seat.dataset.eventId === 'season') seasonSelected = true;
      }
    });
  });
  updateSelectionUI();
  const selectionUI = document.getElementById('selection-ui');
  if (seasonSelected) {
    selectionUI.classList.remove('hidden');
  } else {
    selectionUI.classList.add('hidden');
  }
}

document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);
