const express = require('express');
const router = express.Router();
const { db, seats, indirectHolds, indirectKills, indirectStates, stateCategories, stateCategoryMemberships } = require('../db/index');
const { eq, and, or, inArray } = require('drizzle-orm');
const { getRelatedEvents } = require('../services/propagation');

// Get all seats for an event
router.get('/seats/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const allSeats = await db.select().from(seats).where(eq(seats.eventId, eventId));
    res.json(allSeats);
  } catch (error) {
    console.error('Error fetching seats:', error);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

// Get a single seat by ID
router.get('/seats/id/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const seat = await db.select().from(seats).where(eq(seats.id, parseInt(id))).limit(1);
    if (seat.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    res.json(seat[0]);
  } catch (error) {
    console.error('Error fetching seat:', error);
    res.status(500).json({ error: 'Failed to fetch seat' });
  }
});

// Get seats with indirect holds/kills/states for an event
router.get('/seats/:eventId/with-indirect', async (req, res) => {
  try {
    const { eventId } = req.params;
    const allSeats = await db.select().from(seats).where(eq(seats.eventId, eventId));
    
    // Fetch indirect holds, kills, and states for these seats
    const seatIds = allSeats.map(s => s.id);
    const indirectHoldsData = seatIds.length > 0 
      ? await db.select().from(indirectHolds).where(inArray(indirectHolds.seatId, seatIds))
      : [];
    const indirectStatesData = seatIds.length > 0
      ? await db.select().from(indirectStates).where(inArray(indirectStates.seatId, seatIds))
      : [];
    
    // Map indirect data to seats
    const seatsWithIndirect = allSeats.map(seat => ({
      ...seat,
      indirectHolds: indirectHoldsData.filter(ih => ih.seatId === seat.id),
      indirectStates: indirectStatesData.filter(is => is.seatId === seat.id),
    }));
    
    res.json(seatsWithIndirect);
  } catch (error) {
    console.error('Error fetching seats with indirect:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch seats', details: error.message });
  }
});

// Update not_for_sale flag for a seat
router.put('/seats/:id/not-for-sale', async (req, res) => {
  try {
    const { id } = req.params;
    const { notForSale } = req.body;
    const seatId = parseInt(id);
    
    // Get the seat to check its current state
    const seatResult = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    if (seatResult.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    const seat = seatResult[0];
    
    // Validation: Cannot mark "Not For Sale" if seat is in Sold, Resold, Reserved, In Cart, or Resale Listed state
    const restrictedStates = ['booked', 'reserved_by_token', 'resale'];
    if (notForSale && restrictedStates.includes(seat.seatsIoStatus)) {
      return res.status(400).json({ error: 'Cannot mark seat as "Not For Sale" when it is in Sold, Resold, Reserved, In Cart, or Resale Listed state' });
    }
    
    await db.update(seats)
      .set({ notForSale: Boolean(notForSale) })
      .where(eq(seats.id, seatId));
    
    const updated = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating seat:', error);
    res.status(500).json({ error: 'Failed to update seat' });
  }
});

// Apply direct hold to a seat
router.put('/seats/:id/hold', async (req, res) => {
  try {
    const { id } = req.params;
    const { holdName } = req.body;
    const seatId = parseInt(id);
    
    // Get the seat to find its event
    const seatResult = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    if (seatResult.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    const seat = seatResult[0];
    
    // Update direct hold
    await db.update(seats)
      .set({ directHoldName: holdName })
      .where(eq(seats.id, seatId));
    
    // Get related events for propagation
    const relatedEvents = getRelatedEvents(seat.eventId);
    
    // Find matching seats in related events (same ticket_type, section, row, seat)
    const matchingSeats = await db.select().from(seats).where(
      and(
        inArray(seats.eventId, relatedEvents),
        eq(seats.ticketType, seat.ticketType),
        eq(seats.section, seat.section),
        eq(seats.row, seat.row),
        eq(seats.seat, seat.seat)
      )
    );
    
    // Remove existing indirect holds for these seats from this source
    for (const matchingSeat of matchingSeats) {
      await db.delete(indirectHolds).where(
        and(
          eq(indirectHolds.seatId, matchingSeat.id),
          eq(indirectHolds.sourceEvent, seat.eventId)
        )
      );
    }
    
    // Create indirect holds
    const indirectHoldInserts = matchingSeats.map(matchingSeat => ({
      seatId: matchingSeat.id,
      holdName,
      sourceEvent: seat.eventId,
    }));
    
    if (indirectHoldInserts.length > 0) {
      await db.insert(indirectHolds).values(indirectHoldInserts);
    }
    
    // Return updated seat
    const updated = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error applying hold:', error);
    res.status(500).json({ error: 'Failed to apply hold' });
  }
});

// Remove direct hold from a seat
router.delete('/seats/:id/hold', async (req, res) => {
  try {
    const { id } = req.params;
    const seatId = parseInt(id);
    
    // Get the seat
    const seatResult = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    if (seatResult.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    const seat = seatResult[0];
    
    // Remove direct hold
    await db.update(seats)
      .set({ directHoldName: null })
      .where(eq(seats.id, seatId));
    
    // Get related events
    const relatedEvents = getRelatedEvents(seat.eventId);
    
    // Find matching seats in related events
    const matchingSeats = await db.select().from(seats).where(
      and(
        inArray(seats.eventId, relatedEvents),
        eq(seats.ticketType, seat.ticketType),
        eq(seats.section, seat.section),
        eq(seats.row, seat.row),
        eq(seats.seat, seat.seat)
      )
    );
    
    // Remove indirect holds
    for (const matchingSeat of matchingSeats) {
      await db.delete(indirectHolds).where(
        and(
          eq(indirectHolds.seatId, matchingSeat.id),
          eq(indirectHolds.sourceEvent, seat.eventId)
        )
      );
    }
    
    const updated = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error removing hold:', error);
    res.status(500).json({ error: 'Failed to remove hold' });
  }
});

// Removed kill endpoints - kill feature no longer supported

// Add to Cart endpoint
router.put('/seats/:id/add-to-cart', async (req, res) => {
  try {
    const { id } = req.params;
    const seatId = parseInt(id);
    
    // Get the seat
    const seatResult = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    if (seatResult.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    const seat = seatResult[0];
    
    // Validation: Cannot add to cart if notForSale is true
    if (seat.notForSale) {
      return res.status(400).json({ error: 'Cannot add seat to cart when it is marked as "Not For Sale"' });
    }
    
    // Update seat state
    await db.update(seats)
      .set({ seatsIoStatus: 'reserved_by_token' })
      .where(eq(seats.id, seatId));
    
    // Get related events for propagation
    const relatedEvents = getRelatedEvents(seat.eventId);
    
    // Find matching seats in related events
    const matchingSeats = await db.select().from(seats).where(
      and(
        inArray(seats.eventId, relatedEvents),
        eq(seats.ticketType, seat.ticketType),
        eq(seats.section, seat.section),
        eq(seats.row, seat.row),
        eq(seats.seat, seat.seat)
      )
    );
    
    // Remove existing indirect states for these seats from this source
    for (const matchingSeat of matchingSeats) {
      await db.delete(indirectStates).where(
        and(
          eq(indirectStates.seatId, matchingSeat.id),
          eq(indirectStates.sourceEvent, seat.eventId),
          eq(indirectStates.state, 'reserved_by_token')
        )
      );
    }
    
    // Create indirect states
    const indirectStateInserts = matchingSeats.map(matchingSeat => ({
      seatId: matchingSeat.id,
      state: 'reserved_by_token',
      sourceEvent: seat.eventId,
    }));
    
    if (indirectStateInserts.length > 0) {
      await db.insert(indirectStates).values(indirectStateInserts);
    }
    
    const updated = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error adding seat to cart:', error);
    res.status(500).json({ error: 'Failed to add seat to cart' });
  }
});

// Sell endpoint
router.put('/seats/:id/sell', async (req, res) => {
  try {
    const { id } = req.params;
    const seatId = parseInt(id);
    
    // Get the seat
    const seatResult = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    if (seatResult.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    const seat = seatResult[0];
    
    // Validation: Cannot sell if notForSale is true
    if (seat.notForSale) {
      return res.status(400).json({ error: 'Cannot sell seat when it is marked as "Not For Sale"' });
    }
    
    // Update seat state
    await db.update(seats)
      .set({ 
        seatsIoStatus: 'booked',
        isResale: false,
        isReservation: false
      })
      .where(eq(seats.id, seatId));
    
    // Get related events for propagation
    const relatedEvents = getRelatedEvents(seat.eventId);
    
    // Find matching seats in related events
    const matchingSeats = await db.select().from(seats).where(
      and(
        inArray(seats.eventId, relatedEvents),
        eq(seats.ticketType, seat.ticketType),
        eq(seats.section, seat.section),
        eq(seats.row, seat.row),
        eq(seats.seat, seat.seat)
      )
    );
    
    // Remove existing indirect states for these seats from this source
    for (const matchingSeat of matchingSeats) {
      await db.delete(indirectStates).where(
        and(
          eq(indirectStates.seatId, matchingSeat.id),
          eq(indirectStates.sourceEvent, seat.eventId),
          eq(indirectStates.state, 'booked')
        )
      );
    }
    
    // Create indirect states
    const indirectStateInserts = matchingSeats.map(matchingSeat => ({
      seatId: matchingSeat.id,
      state: 'booked',
      sourceEvent: seat.eventId,
    }));
    
    if (indirectStateInserts.length > 0) {
      await db.insert(indirectStates).values(indirectStateInserts);
    }
    
    const updated = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error selling seat:', error);
    res.status(500).json({ error: 'Failed to sell seat' });
  }
});

// Reserve endpoint
router.put('/seats/:id/reserve', async (req, res) => {
  try {
    const { id } = req.params;
    const seatId = parseInt(id);
    
    // Get the seat
    const seatResult = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    if (seatResult.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    const seat = seatResult[0];
    
    // Validation: Cannot reserve if notForSale is true
    if (seat.notForSale) {
      return res.status(400).json({ error: 'Cannot reserve seat when it is marked as "Not For Sale"' });
    }
    
    // Update seat state
    await db.update(seats)
      .set({ 
        seatsIoStatus: 'booked',
        isReservation: true
      })
      .where(eq(seats.id, seatId));
    
    // Get related events for propagation
    const relatedEvents = getRelatedEvents(seat.eventId);
    
    // Find matching seats in related events
    const matchingSeats = await db.select().from(seats).where(
      and(
        inArray(seats.eventId, relatedEvents),
        eq(seats.ticketType, seat.ticketType),
        eq(seats.section, seat.section),
        eq(seats.row, seat.row),
        eq(seats.seat, seat.seat)
      )
    );
    
    // Remove existing indirect states for these seats from this source
    for (const matchingSeat of matchingSeats) {
      await db.delete(indirectStates).where(
        and(
          eq(indirectStates.seatId, matchingSeat.id),
          eq(indirectStates.sourceEvent, seat.eventId),
          eq(indirectStates.state, 'booked')
        )
      );
    }
    
    // Create indirect states
    const indirectStateInserts = matchingSeats.map(matchingSeat => ({
      seatId: matchingSeat.id,
      state: 'booked',
      sourceEvent: seat.eventId,
    }));
    
    if (indirectStateInserts.length > 0) {
      await db.insert(indirectStates).values(indirectStateInserts);
    }
    
    const updated = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error reserving seat:', error);
    res.status(500).json({ error: 'Failed to reserve seat' });
  }
});

// List endpoint (for resale)
router.put('/seats/:id/list', async (req, res) => {
  try {
    const { id } = req.params;
    const seatId = parseInt(id);
    
    // Get the seat
    const seatResult = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    if (seatResult.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    const seat = seatResult[0];
    
    // Validation: Must be in Sold state (booked, not resale, not reservation) and not notForSale
    if (seat.notForSale) {
      return res.status(400).json({ error: 'Cannot list seat when it is marked as "Not For Sale"' });
    }
    if (seat.seatsIoStatus !== 'booked' || seat.isResale || seat.isReservation) {
      return res.status(400).json({ error: 'Can only list seats that are in Sold state' });
    }
    
    // Update seat state (NO propagation)
    await db.update(seats)
      .set({ 
        seatsIoStatus: 'resale',
        isResale: true
      })
      .where(eq(seats.id, seatId));
    
    const updated = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error listing seat:', error);
    res.status(500).json({ error: 'Failed to list seat' });
  }
});

// Resell endpoint
router.put('/seats/:id/resell', async (req, res) => {
  try {
    const { id } = req.params;
    const seatId = parseInt(id);
    
    // Get the seat
    const seatResult = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    if (seatResult.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    const seat = seatResult[0];
    
    // Validation: Must be in Resale Listed state and not notForSale
    if (seat.notForSale) {
      return res.status(400).json({ error: 'Cannot resell seat when it is marked as "Not For Sale"' });
    }
    if (seat.seatsIoStatus !== 'resale') {
      return res.status(400).json({ error: 'Can only resell seats that are in Resale Listed state' });
    }
    
    // Update seat state (NO propagation)
    await db.update(seats)
      .set({ 
        seatsIoStatus: 'booked',
        isResale: true
      })
      .where(eq(seats.id, seatId));
    
    const updated = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error reselling seat:', error);
    res.status(500).json({ error: 'Failed to resell seat' });
  }
});

// Batch update seats (for not_for_sale flags)
router.post('/seats/batch-update', async (req, res) => {
  try {
    const { updates } = req.body; // Array of {id, notForSale}
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }
    
    // Update each seat
    for (const update of updates) {
      await db.update(seats)
        .set({ notForSale: Boolean(update.notForSale) })
        .where(eq(seats.id, parseInt(update.id)));
    }
    
    // Fetch updated seats
    const ids = updates.map(u => parseInt(u.id));
    const updatedSeats = await db.select().from(seats).where(inArray(seats.id, ids));
    
    res.json(updatedSeats);
  } catch (error) {
    console.error('Error batch updating seats:', error);
    res.status(500).json({ error: 'Failed to batch update seats' });
  }
});

// Reset all seats (clear holds, kills, set not_for_sale to false, reset states)
router.post('/seats/reset-all', async (req, res) => {
  try {
    // Clear all direct holds, kills, and reset states
    await db.update(seats)
      .set({
        directHoldName: null,
        killName: null,
        notForSale: false,
        seatsIoStatus: 'free',
        isResale: false,
        isReservation: false,
      });
    
    // Clear all indirect holds, kills, and states
    await db.delete(indirectHolds);
    await db.delete(indirectKills);
    await db.delete(indirectStates);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting seats:', error);
    res.status(500).json({ error: 'Failed to reset seats' });
  }
});

// Get all state categories with memberships
router.get('/state-categories', async (req, res) => {
  try {
    const categories = await db.select().from(stateCategories).orderBy(stateCategories.displayOrder);
    
    const categoriesWithStates = await Promise.all(
      categories.map(async (category) => {
        const memberships = await db.select().from(stateCategoryMemberships)
          .where(eq(stateCategoryMemberships.categoryId, category.id));
        return {
          ...category,
          states: memberships.map(m => m.stateName),
        };
      })
    );
    
    res.json(categoriesWithStates);
  } catch (error) {
    console.error('Error fetching state categories:', error);
    res.status(500).json({ error: 'Failed to fetch state categories' });
  }
});

// Create state category
router.post('/state-categories', async (req, res) => {
  try {
    const { name, displayOrder } = req.body;
    
    // Get max display order if not provided
    let order = displayOrder;
    if (order === undefined || order === null) {
      const maxOrder = await db.select().from(stateCategories).orderBy(stateCategories.displayOrder);
      order = maxOrder.length > 0 ? maxOrder[maxOrder.length - 1].displayOrder + 1 : 0;
    }
    
    const [newCategory] = await db.insert(stateCategories).values({
      name: name || 'new state category',
      displayOrder: order,
    }).returning();
    
    res.json(newCategory);
  } catch (error) {
    console.error('Error creating state category:', error);
    res.status(500).json({ error: 'Failed to create state category' });
  }
});

// Update state category name
router.put('/state-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    await db.update(stateCategories)
      .set({ name })
      .where(eq(stateCategories.id, parseInt(id)));
    
    const [updated] = await db.select().from(stateCategories).where(eq(stateCategories.id, parseInt(id)));
    res.json(updated);
  } catch (error) {
    console.error('Error updating state category:', error);
    res.status(500).json({ error: 'Failed to update state category' });
  }
});

// Delete state category
router.delete('/state-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(stateCategories).where(eq(stateCategories.id, parseInt(id)));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting state category:', error);
    res.status(500).json({ error: 'Failed to delete state category' });
  }
});

// Update state category memberships
router.put('/state-categories/:id/memberships', async (req, res) => {
  try {
    const { id } = req.params;
    const { stateNames } = req.body;
    const categoryId = parseInt(id);
    
    // Delete existing memberships
    await db.delete(stateCategoryMemberships).where(eq(stateCategoryMemberships.categoryId, categoryId));
    
    // Insert new memberships
    if (stateNames && stateNames.length > 0) {
      const memberships = stateNames.map(stateName => ({
        categoryId,
        stateName,
      }));
      await db.insert(stateCategoryMemberships).values(memberships);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating state category memberships:', error);
    res.status(500).json({ error: 'Failed to update state category memberships' });
  }
});

// Initialize default state category
router.post('/state-categories/initialize-default', async (req, res) => {
  try {
    // Check if any categories exist
    const existing = await db.select().from(stateCategories);
    
    if (existing.length > 0) {
      return res.json({ message: 'Categories already exist', categories: existing });
    }
    
    // Create "All" category
    const [allCategory] = await db.insert(stateCategories).values({
      name: 'All',
      displayOrder: 0,
    }).returning();
    
    // Add all states to "All" category
    const allStates = ['Open', 'In Cart', 'Sold', 'Reserved', 'Resold', 'Killed', 'Resale Listed'];
    const memberships = allStates.map(stateName => ({
      categoryId: allCategory.id,
      stateName,
    }));
    
    await db.insert(stateCategoryMemberships).values(memberships);
    
    res.json({ success: true, category: allCategory });
  } catch (error) {
    console.error('Error initializing default state category:', error);
    res.status(500).json({ error: 'Failed to initialize default state category' });
  }
});

module.exports = router;

