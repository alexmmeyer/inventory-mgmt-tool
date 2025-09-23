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
const seatGrid = { rows: 5, cols: 6 };
const onlyAvailHereState = {}; // { seatId: mapId }

let selectedSeats = new Set();
let holdColor = null;
let hasUnsavedChanges = false;
let currentAction = null; // 'hold' or 'kill'

function createSeat(row, col, mapId) {
  const seat = document.createElement('div');
  seat.className = 'seat';
  seat.dataset.map = mapId;
  seat.dataset.id = `${row}-${col}`;

  // Color for parent/child maps
  if (mapId === 'season') {
    seat.style.backgroundColor = '#4CAF50'; // Green for season map
    seat.classList.add('season-seat');
    seat.addEventListener('click', (e) => {
      if (isSelecting) return;
      toggleSeatSelection(seat);
      // Only open selection drawer for season map seats
      document.getElementById('selection-ui').classList.remove('hidden');
      e.stopPropagation();
      updateAvailableSeatsTable();
    });
  } else {
    // For all other maps (package, event), always close the drawer
    seat.style.backgroundColor = ['packageA', 'packageB'].includes(mapId) ? '#7279feff' : '#b7bafeff';
    if (['packageA', 'packageB'].includes(mapId)) seat.classList.add('package-seat');
    else { seat.classList.add('child'); seat.classList.add('event-seat'); }
    seat.addEventListener('click', (e) => {
      if (isSelecting) return;
      toggleSeatSelection(seat);
      document.getElementById('selection-ui').classList.add('hidden');
      e.stopPropagation();
      updateAvailableSeatsTable();
    });
  }

  return seat;
}

function renderMaps() {
  const rowLabels = ['A', 'B', 'C', 'D', 'E'];
  const colLabels = ['1', '2', '3', '4', '5', '6'];

  seatMaps.forEach(mapId => {
    const container = document.getElementById(mapId);
    if (!container) return;
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'seat-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `30px repeat(${seatGrid.cols}, 30px)`;
    grid.style.gridTemplateRows = `30px repeat(${seatGrid.rows}, 30px)`;
    grid.style.gap = '5px';

    // Top-left empty cell
    const emptyCell = document.createElement('div');
    emptyCell.style.gridRow = '1';
    emptyCell.style.gridColumn = '1';
    grid.appendChild(emptyCell);

    // Column labels
    for (let col = 0; col < seatGrid.cols; col++) {
      const colLabel = document.createElement('div');
      colLabel.textContent = colLabels[col];
      colLabel.style.textAlign = 'center';
      colLabel.style.fontWeight = '400';
      colLabel.style.fontSize = '13px';
      colLabel.style.lineHeight = '30px';
      colLabel.style.gridRow = '1';
      colLabel.style.gridColumn = `${col + 2}`;
      grid.appendChild(colLabel);
    }

    // Row labels and seats
    for (let row = 0; row < seatGrid.rows; row++) {
      // Row label
      const rowLabel = document.createElement('div');
      rowLabel.textContent = rowLabels[row];
      rowLabel.style.textAlign = 'right';
      rowLabel.style.fontWeight = '400';
      rowLabel.style.fontSize = '13px';
      rowLabel.style.lineHeight = '30px';
      rowLabel.style.gridRow = `${row + 2}`;
      rowLabel.style.gridColumn = '1';
      grid.appendChild(rowLabel);

      // Seats
      for (let col = 0; col < seatGrid.cols; col++) {
        const seat = createSeat(row, col, mapId);
        seat.style.width = '30px';
        seat.style.height = '30px';
        seat.style.margin = '0';
        seat.style.borderRadius = '50%';
        seat.style.boxSizing = 'border-box';
        seat.style.cursor = 'pointer';
        seat.style.userSelect = 'none';
        seat.style.gridRow = `${row + 2}`;
        seat.style.gridColumn = `${col + 2}`;
        grid.appendChild(seat);
      }
    }

    container.appendChild(grid);
  });
  updateAvailableSeatsTable();
}

function toggleSeatSelection(seat) {
  const id = `${seat.dataset.map}:${seat.dataset.id}`;
  seat.classList.toggle('selected');
  if (selectedSeats.has(id)) {
    selectedSeats.delete(id);
  } else {
    selectedSeats.add(id);
  }
  updateSelectionUI();
}

function clearSelection() {
  document.querySelectorAll('.seat.selected').forEach(seat => seat.classList.remove('selected'));
  selectedSeats.clear();
  hasUnsavedChanges = false;
  updateSaveButton();
  updateSelectionUI();
}

function saveSelection() {
  // Apply the changes made via checkboxes
  const allMaps = ['packageA', 'packageB', 'event1', 'event2', 'event3'];
  selectedSeats.forEach(key => {
    const [selectedMapId, seatId] = key.split(':');
    allMaps.forEach(mapId => {
      const checkbox = document.getElementById(`pkg-${mapId}`) || document.getElementById(`evt-${mapId}`);
      const seat = document.querySelector(`.seat[data-map='${mapId}'][data-id='${seatId}']`);
      if (seat && checkbox) {
        if (checkbox.checked) {
          seat.classList.remove('unselectable');
        } else {
          seat.classList.add('unselectable');
        }
      }
    });
  });
  hasUnsavedChanges = false;
  updateSaveButton();
  updateAvailableSeatsTable();
  // Clear selection and close the UI immediately
  clearSelection();
}

function releaseHold() {
  selectedSeats.forEach(key => {
    const [mapId, seatId] = key.split(':');
    const seat = document.querySelector(`.seat[data-map='${mapId}'][data-id='${seatId}']`);
    
    // Only allow releasing holds from seats where the hold was originally placed (solid border)
    if (seat && seat.style.borderStyle === 'solid' && seat.style.borderColor && seat.style.borderColor !== 'transparent') {
      seat.style.borderColor = 'transparent';
      seat.style.borderStyle = 'solid';

      if (parentMaps[mapId]) {
        parentMaps[mapId].forEach(childId => {
          const childSeat = document.querySelector(`.seat[data-map='${childId}'][data-id='${seatId}']`);
          if (childSeat) {
            childSeat.style.borderColor = 'transparent';
            childSeat.style.borderStyle = 'dotted';
          }
        });
      }

      Object.keys(parentMaps).forEach(otherParent => {
        if (otherParent !== mapId) {
          const otherParentSeat = document.querySelector(`.seat[data-map='${otherParent}'][data-id='${seatId}']`);
          if (otherParentSeat) {
            otherParentSeat.style.borderColor = 'transparent';
            otherParentSeat.style.borderStyle = 'dotted';
          }
        }
      });
    }
  });

  clearSelection();
  updateAvailableSeatsTable();
}

function releaseKill() {
  selectedSeats.forEach(key => {
    const [mapId, seatId] = key.split(':');
    const seat = document.querySelector(`.seat[data-map='${mapId}'][data-id='${seatId}']`);
    
    // Only allow releasing kills from seats where the kill was originally placed (capital X)
    const directKillMark = seat?.querySelector('.kill-mark.direct-kill');
    if (seat && directKillMark) {
      // Remove the direct kill mark
      directKillMark.remove();

      // Remove indirect kills from related seats
      if (parentMaps[mapId]) {
        parentMaps[mapId].forEach(childId => {
          const childSeat = document.querySelector(`.seat[data-map='${childId}'][data-id='${seatId}']`);
          if (childSeat) {
            const indirectKillMark = childSeat.querySelector('.kill-mark.indirect-kill');
            if (indirectKillMark) indirectKillMark.remove();
          }
        });
      }

      Object.keys(parentMaps).forEach(otherParent => {
        if (otherParent !== mapId) {
          const otherParentSeat = document.querySelector(`.seat[data-map='${otherParent}'][data-id='${seatId}']`);
          if (otherParentSeat) {
            const indirectKillMark = otherParentSeat.querySelector('.kill-mark.indirect-kill');
            if (indirectKillMark) indirectKillMark.remove();
          }
        }
      });
    }
  });

  clearSelection();
  updateAvailableSeatsTable();
}

function applyHoldToSelectedSeats(color) {
  selectedSeats.forEach(key => {
    const [mapId, seatId] = key.split(':');
    const seat = document.querySelector(`.seat[data-map='${mapId}'][data-id='${seatId}']`);
    if (seat) {
      seat.style.borderColor = color;
      seat.style.borderStyle = 'solid';
    }

    if (parentMaps[mapId]) {
      parentMaps[mapId].forEach(childId => {
        const childSeat = document.querySelector(`.seat[data-map='${childId}'][data-id='${seatId}']`);
        if (childSeat) {
          childSeat.style.borderColor = color;
          childSeat.style.borderStyle = 'dotted';
        }
      });

      Object.keys(parentMaps).forEach(otherParent => {
        if (otherParent !== mapId) {
          const otherParentSeat = document.querySelector(`.seat[data-map='${otherParent}'][data-id='${seatId}']`);
          if (otherParentSeat) {
            otherParentSeat.style.borderColor = color;
            otherParentSeat.style.borderStyle = 'dotted';
          }
        }
      });

    } else if (childMaps[mapId]) {
      childMaps[mapId].forEach(parentId => {
        const parentSeat = document.querySelector(`.seat[data-map='${parentId}'][data-id='${seatId}']`);
        if (parentSeat) {
          parentSeat.style.borderColor = color;
          parentSeat.style.borderStyle = 'dotted';
        }
      });
    }
  });

  clearSelection();
  document.getElementById('palette').classList.add('hidden');
  updateAvailableSeatsTable();
}

function applyKillToSelectedSeats(color) {
  selectedSeats.forEach(key => {
    const [mapId, seatId] = key.split(':');
    const seat = document.querySelector(`.seat[data-map='${mapId}'][data-id='${seatId}']`);
    if (seat) {
      // Add capital X for directly killed seats
      const killMark = document.createElement('div');
      killMark.className = 'kill-mark direct-kill';
      killMark.textContent = 'X';
      killMark.style.color = color;
      killMark.style.position = 'absolute';
      killMark.style.top = '50%';
      killMark.style.left = '50%';
      killMark.style.transform = 'translate(-50%, -50%)';
      killMark.style.fontSize = '14px';
      killMark.style.fontWeight = 'bold';
      killMark.style.pointerEvents = 'none';
      killMark.style.zIndex = '10';
      
      // Remove any existing kill mark
      const existingKill = seat.querySelector('.kill-mark');
      if (existingKill) existingKill.remove();
      
      seat.style.position = 'relative';
      seat.appendChild(killMark);
    }

    if (parentMaps[mapId]) {
      parentMaps[mapId].forEach(childId => {
        const childSeat = document.querySelector(`.seat[data-map='${childId}'][data-id='${seatId}']`);
        if (childSeat) {
          // Add lowercase x for indirectly killed seats
          const killMark = document.createElement('div');
          killMark.className = 'kill-mark indirect-kill';
          killMark.textContent = 'x';
          killMark.style.color = color;
          killMark.style.position = 'absolute';
          killMark.style.top = '50%';
          killMark.style.left = '50%';
          killMark.style.transform = 'translate(-50%, -50%)';
          killMark.style.fontSize = '12px';
          killMark.style.fontWeight = 'normal';
          killMark.style.pointerEvents = 'none';
          killMark.style.zIndex = '10';
          
          // Remove any existing kill mark
          const existingKill = childSeat.querySelector('.kill-mark');
          if (existingKill) existingKill.remove();
          
          childSeat.style.position = 'relative';
          childSeat.appendChild(killMark);
        }
      });

      Object.keys(parentMaps).forEach(otherParent => {
        if (otherParent !== mapId) {
          const otherParentSeat = document.querySelector(`.seat[data-map='${otherParent}'][data-id='${seatId}']`);
          if (otherParentSeat) {
            // Add lowercase x for indirectly killed seats in other packages
            const killMark = document.createElement('div');
            killMark.className = 'kill-mark indirect-kill';
            killMark.textContent = 'x';
            killMark.style.color = color;
            killMark.style.position = 'absolute';
            killMark.style.top = '50%';
            killMark.style.left = '50%';
            killMark.style.transform = 'translate(-50%, -50%)';
            killMark.style.fontSize = '12px';
            killMark.style.fontWeight = 'normal';
            killMark.style.pointerEvents = 'none';
            killMark.style.zIndex = '10';
            
            // Remove any existing kill mark
            const existingKill = otherParentSeat.querySelector('.kill-mark');
            if (existingKill) existingKill.remove();
            
            otherParentSeat.style.position = 'relative';
            otherParentSeat.appendChild(killMark);
          }
        }
      });

    } else if (childMaps[mapId]) {
      childMaps[mapId].forEach(parentId => {
        const parentSeat = document.querySelector(`.seat[data-map='${parentId}'][data-id='${seatId}']`);
        if (parentSeat) {
          // Add lowercase x for indirectly killed seats in parent packages
          const killMark = document.createElement('div');
          killMark.className = 'kill-mark indirect-kill';
          killMark.textContent = 'x';
          killMark.style.color = color;
          killMark.style.position = 'absolute';
          killMark.style.top = '50%';
          killMark.style.left = '50%';
          killMark.style.transform = 'translate(-50%, -50%)';
          killMark.style.fontSize = '12px';
          killMark.style.fontWeight = 'normal';
          killMark.style.pointerEvents = 'none';
          killMark.style.zIndex = '10';
          
          // Remove any existing kill mark
          const existingKill = parentSeat.querySelector('.kill-mark');
          if (existingKill) existingKill.remove();
          
          parentSeat.style.position = 'relative';
          parentSeat.appendChild(killMark);
        }
      });
    }
  });

  clearSelection();
  document.getElementById('palette').classList.add('hidden');
  updateAvailableSeatsTable();
}


function makeUnselectable() {
  // Removed: Unselectable logic
}

function makeSelectable() {
  // Removed: Make selectable logic
}

function onlyAvailHere() {
  // Removed: Only avail here logic
}

function removeOnlyAvailHere() {
  // Removed: Remove only avail here logic
}

function resetAll() {
  selectedSeats.clear();
  hasUnsavedChanges = false;
  updateSaveButton();
  document.querySelectorAll('.seat').forEach(seat => {
    seat.style.border = '2px solid transparent';
    seat.classList.remove('selected', 'unselectable');
    // Remove green star if present
    const star = seat.querySelector('.only-avail-star');
    if (star) star.remove();
    // Remove kill marks if present
    const killMark = seat.querySelector('.kill-mark');
    if (killMark) killMark.remove();
  });
  // Clear onlyAvailHereState
  Object.keys(onlyAvailHereState).forEach(seatId => {
    delete onlyAvailHereState[seatId];
  });
  updateAvailableSeatsTable();
  updateSelectionUI();
}

// Make sure this is wired up:
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reset').addEventListener('click', resetAll);
  document.getElementById('remove-only-avail').addEventListener('click', removeOnlyAvailHere);
});

// --- Selection UI ---
function updateSelectionUI() {
  const selectionUI = document.getElementById('selection-ui');
  const selectionCount = document.getElementById('selection-count');
  const selectionDetails = document.getElementById('selection-details');
  
  if (selectedSeats.size === 0) {
    selectionUI.classList.add('hidden');
    return;
  }
  // Only open the drawer if a season seat is selected, but do NOT close it if already open
  let hasSeasonSeat = false;
  for (const key of selectedSeats) {
    const [mapId] = key.split(':');
    if (mapId === 'season') {
      hasSeasonSeat = true;
      break;
    }
  }
  if (hasSeasonSeat) {
    selectionUI.classList.remove('hidden');
  }
  selectionCount.textContent = `${selectedSeats.size} seat${selectedSeats.size === 1 ? '' : 's'} selected`;
  
  // Get selected seat details
  const seatDetails = Array.from(selectedSeats).map(key => {
    const [mapId, seatId] = key.split(':');
    const [rowIdx, colIdx] = seatId.split('-').map(Number);
    const rowLabel = String.fromCharCode(65 + rowIdx);
    const colLabel = colIdx + 1;
    return `${mapId}:${rowLabel}${colLabel}`;
  });
  selectionDetails.textContent = seatDetails.join(', ');
  
  // Update availability checkboxes
  updateAvailabilityCheckboxes();
  
  // Add checkbox event listeners
  addCheckboxEventListeners();
}

function addCheckboxEventListeners() {
  const allMaps = ['packageA', 'packageB', 'event1', 'event2', 'event3'];
  
  allMaps.forEach(mapId => {
    const checkbox = document.getElementById(`pkg-${mapId}`) || document.getElementById(`evt-${mapId}`);
    if (checkbox) {
      // Remove existing listeners to avoid duplicates
      checkbox.removeEventListener('change', handleCheckboxChange);
      checkbox.addEventListener('change', handleCheckboxChange);
    }
  });
}

function handleCheckboxChange(event) {
  const checkbox = event.target;
  const mapId = checkbox.dataset.map;
  const isChecked = checkbox.checked;
  
  // Toggle seat availability for this map
  selectedSeats.forEach(key => {
    const [selectedMapId, seatId] = key.split(':');
    const seat = document.querySelector(`.seat[data-map='${mapId}'][data-id='${seatId}']`);
    
    if (seat) {
      if (isChecked) {
        seat.classList.remove('unselectable');
      } else {
        seat.classList.add('unselectable');
      }
    }
  });
  
  // Mark as having unsaved changes
  hasUnsavedChanges = true;
  updateSaveButton();
  
  // Update the availability checkboxes to reflect the changes
  updateAvailabilityCheckboxes();
  // Do NOT close the selection drawer here. Only close on save/clear.
}

function updateSaveButton() {
  const saveBtn = document.getElementById('save-selection');
  if (hasUnsavedChanges) {
    saveBtn.classList.remove('hidden');
  } else {
    saveBtn.classList.add('hidden');
  }
}

function updateAvailabilityCheckboxes() {
  const allMaps = ['packageA', 'packageB', 'event1', 'event2', 'event3'];
  
  allMaps.forEach(mapId => {
    const checkbox = document.getElementById(`pkg-${mapId}`) || document.getElementById(`evt-${mapId}`);
    const countElement = document.getElementById(`count-${mapId}`);
    const checkboxItem = checkbox.closest('.checkbox-item');
    
    if (!checkbox || !countElement) return;
    
    const availability = calculateSeatAvailability(mapId);
    
    // Update seat count display
    countElement.textContent = `(${availability.available}/${selectedSeats.size})`;
    
    // Update checkbox state
    if (availability.available === selectedSeats.size) {
      // All selected seats are available in this map
      checkbox.checked = true;
      checkbox.indeterminate = false;
      checkboxItem.classList.remove('mixed-state');
    } else if (availability.available === 0) {
      // No selected seats are available in this map
      checkbox.checked = false;
      checkbox.indeterminate = false;
      checkboxItem.classList.remove('mixed-state');
    } else {
      // Some selected seats are available in this map (mixed state)
      checkbox.checked = true; // Show tick but greyed out
      checkbox.indeterminate = false;
      checkboxItem.classList.add('mixed-state');
    }
  });
}

function calculateSeatAvailability(mapId) {
  let available = 0;
  
  selectedSeats.forEach(key => {
    const [selectedMapId, seatId] = key.split(':');
    const seat = document.querySelector(`.seat[data-map='${mapId}'][data-id='${seatId}']`);
    
    if (seat && !seat.classList.contains('unselectable')) {
      available++;
    }
  });
  
  return { available, total: selectedSeats.size };
}

// --- Available seats table ---
function getHoldName(color) {
  switch (color.toLowerCase()) {
    case '#ff0000':
    case 'rgb(255, 0, 0)':
      return 'red';
    case '#00ff00':
    case 'rgb(0, 255, 0)':
      return 'green';
    case '#0000ff':
    case 'rgb(0, 0, 255)':
      return 'blue';
    case '#ffa500':
    case 'rgb(255, 165, 0)':
      return 'orange';
    default:
      return color;
  }
}

function getKillName(color) {
  switch (color.toLowerCase()) {
    case '#ff0000':
    case 'rgb(255, 0, 0)':
      return 'red';
    case '#00ff00':
    case 'rgb(0, 255, 0)':
      return 'green';
    case '#0000ff':
    case 'rgb(0, 0, 255)':
      return 'blue';
    case '#ffa500':
    case 'rgb(255, 165, 0)':
      return 'orange';
    default:
      return color;
  }
}

function updateAvailableSeatsTable() {
  const tableContainer = document.getElementById('available-seats-table');
  if (!tableContainer) return;

  const separateByHold = document.getElementById('separate-by-hold')?.checked;
  const includeUnavailable = document.getElementById('include-unavailable')?.checked;
  const includeHeldKilledElsewhere = document.getElementById('include-held-killed-elsewhere')?.checked;

  const available = {};
  seatMaps.forEach(mapId => {
    if (mapId === 'season') return; // Exclude season map
    const container = document.getElementById(mapId);
    if (!container) return;
    container.querySelectorAll('.seat').forEach(seat => {
      const [rowIdx, colIdx] = seat.dataset.id.split('-').map(Number);
      const rowLabel = String.fromCharCode(65 + rowIdx);
      const colLabel = colIdx + 1;
      let hold = '-';
      let holdSource = '';
      let kill = '-';
      let killSource = '';
      let availability = seat.classList.contains('unselectable') ? 'Not For Sale' : 'For Sale';
      
      // Check for holds
      if (seat.style.borderStyle === 'solid' && seat.style.borderColor && seat.style.borderColor !== 'transparent') {
        hold = getHoldName(seat.style.borderColor);
      }
      if (seat.style.borderStyle === 'dotted' && seat.style.borderColor && seat.style.borderColor !== 'transparent') {
        hold = getHoldName(seat.style.borderColor);
        let foundHoldSource = false;
        
        // Check all other maps for the source of this hold
        seatMaps.forEach(otherMapId => {
          if (otherMapId === mapId || otherMapId === 'season' || foundHoldSource) return;
          
          const otherSeat = document.querySelector(`.seat[data-map='${otherMapId}'][data-id='${seat.dataset.id}']`);
          if (
            otherSeat &&
            otherSeat.style.borderStyle === 'solid' &&
            getHoldName(otherSeat.style.borderColor) === hold
          ) {
            holdSource = otherMapId;
            foundHoldSource = true;
          }
        });
      }
      
      // Check for kills
      const directKillMark = seat.querySelector('.kill-mark.direct-kill');
      const indirectKillMark = seat.querySelector('.kill-mark.indirect-kill');
      
      if (directKillMark) {
        kill = getKillName(directKillMark.style.color);
      } else if (indirectKillMark) {
        kill = getKillName(indirectKillMark.style.color);
        let foundKillSource = false;
        
        // Check all other maps for the source of this kill
        seatMaps.forEach(otherMapId => {
          if (otherMapId === mapId || otherMapId === 'season' || foundKillSource) return;
          
          const otherSeat = document.querySelector(`.seat[data-map='${otherMapId}'][data-id='${seat.dataset.id}']`);
          const otherDirectKill = otherSeat?.querySelector('.kill-mark.direct-kill');
          if (otherDirectKill && getKillName(otherDirectKill.style.color) === kill) {
            killSource = otherMapId;
            foundKillSource = true;
          }
        });
      }
      
      // Apply filtering logic
      if (!includeUnavailable && availability === 'Not For Sale') return;
      
      // Check if seat has indirect hold or kill (held/killed in another event)
      const hasIndirectHold = seat.style.borderStyle === 'dotted' && seat.style.borderColor && seat.style.borderColor !== 'transparent';
      const hasIndirectKill = seat.querySelector('.kill-mark.indirect-kill');
      const isHeldKilledElsewhere = hasIndirectHold || hasIndirectKill;
      
      if (!includeHeldKilledElsewhere && isHeldKilledElsewhere) return;
      
      if (!available[mapId]) available[mapId] = {};
      if (!available[mapId][rowLabel]) available[mapId][rowLabel] = [];
      available[mapId][rowLabel].push({ col: colLabel, hold, holdSource, kill, killSource, availability });
    });
  });

  let consolidatedRows = [];
  Object.entries(available).forEach(([map, rows]) => {
    Object.entries(rows).forEach(([row, seats]) => {
      seats.sort((a, b) => a.col - b.col);
      let i = 0;
      while (i < seats.length) {
        let start = seats[i].col;
        let end = seats[i].col;
        let hold = seats[i].hold;
        let holdSource = seats[i].holdSource;
        let kill = seats[i].kill;
        let killSource = seats[i].killSource;
        let availability = seats[i].availability;
        let j = i + 1;
        while (
          j < seats.length &&
          seats[j].col === end + 1 &&
          seats[j].hold === hold &&
          seats[j].holdSource === holdSource &&
          seats[j].kill === kill &&
          seats[j].killSource === killSource &&
          seats[j].availability === availability
        ) {
          end = seats[j].col;
          j++;
        }
        consolidatedRows.push({
          map,
          row,
          from: start,
          to: end,
          numSeats: end - start + 1,
          hold: hold,
          holdSource: holdSource,
          kill: kill,
          killSource: killSource,
          availability: availability
        });
        i = j;
      }
    });
  });

  if (consolidatedRows.length === 0) {
    tableContainer.innerHTML = '<p>No available seats.</p>';
    return;
  }

  let html = '<table style="margin: 20px auto; border-collapse: collapse;"><thead><tr>' +
  '<th style="border:1px solid #ccc;">Event</th>' +
  '<th style="border:1px solid #ccc;">Row</th>' +
  '<th style="border:1px solid #ccc;">Seat (from)</th>' +
  '<th style="border:1px solid #ccc;">Seat (to)</th>' +
  '<th style="border:1px solid #ccc;">Num seats</th>' +
  '<th style="border:1px solid #ccc;">Availability</th>';
  if (separateByHold) {
    html += '<th style="border:1px solid #ccc;">Hold</th>';
    if (includeHeldKilledElsewhere) {
      html += '<th style="border:1px solid #ccc;">Hold Source</th>';
    }
    html += '<th style="border:1px solid #ccc;">Kill</th>';
    if (includeHeldKilledElsewhere) {
      html += '<th style="border:1px solid #ccc;">Kill Source</th>';
    }
  }
  html += '</tr></thead><tbody>';
  consolidatedRows.forEach(row => {
  const rowColor = row.availability === 'For Sale' ? '#111' : (row.availability === 'Not For Sale' ? 'red' : 'inherit');
  html += `<tr style="color:${rowColor};">
      <td style="border:1px solid #ccc;">${row.map}</td>
      <td style="border:1px solid #ccc;">${row.row}</td>
      <td style="border:1px solid #ccc;">${row.from}</td>
      <td style="border:1px solid #ccc;">${row.to}</td>
      <td style="border:1px solid #ccc;">${row.numSeats}</td>
      <td style="border:1px solid #ccc;">${row.availability}</td>`;
    if (separateByHold) {
      html += `<td style="border:1px solid #ccc;">${row.hold === '-' ? '-' : row.hold}</td>`;
      if (includeHeldKilledElsewhere) {
        html += `<td style="border:1px solid #ccc;">${row.holdSource ? row.holdSource : ''}</td>`;
      }
      html += `<td style="border:1px solid #ccc;">${row.kill === '-' ? '-' : row.kill}</td>`;
      if (includeHeldKilledElsewhere) {
        html += `<td style="border:1px solid #ccc;">${row.killSource ? row.killSource : ''}</td>`;
      }
    }
    html += '</tr>';
  });
  html += '</tbody></table>';
  tableContainer.innerHTML = html;
}

// Listen for checkbox changes
document.addEventListener('DOMContentLoaded', () => {
  const sepHold = document.getElementById('separate-by-hold');
  if (sepHold) {
    sepHold.addEventListener('change', updateAvailableSeatsTable);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  renderMaps();

  document.getElementById('palette').classList.add('hidden');
  document.getElementById('hold').addEventListener('click', () => {
    currentAction = 'hold';
    document.getElementById('palette').classList.toggle('hidden');
  });

  document.getElementById('kill').addEventListener('click', () => {
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

  document.getElementById('release-hold').addEventListener('click', releaseHold);
  document.getElementById('release-kill').addEventListener('click', releaseKill);
  document.getElementById('reset').addEventListener('click', resetAll);
  
  // Selection UI event listeners
  document.getElementById('clear-selection').addEventListener('click', clearSelection);
  document.getElementById('save-selection').addEventListener('click', saveSelection);

  // Selection drawer: select/deselect all for packages/events
  // Packages
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
  // Events
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
  // Prevent area selection if mousedown is inside the selection drawer
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
        if (seat.dataset.map === 'season') seasonSelected = true;
      }
    });
  });
  updateSelectionUI();
  // Only open drawer if a season seat was selected
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