const { pgTable, serial, varchar, integer, boolean, uniqueIndex } = require('drizzle-orm/pg-core');

// Seats table
const seats = pgTable('seats', {
  id: serial('id').primaryKey(),
  eventId: varchar('event_id', { length: 50 }).notNull(),
  ticketType: varchar('ticket_type', { length: 50 }).notNull(),
  section: varchar('section', { length: 10 }).notNull(),
  row: varchar('row', { length: 10 }).notNull(),
  seat: integer('seat').notNull(),
  seatingType: varchar('seating_type', { length: 20 }).default('Row').notNull(),
  directHoldName: varchar('direct_hold_name', { length: 50 }),
  killName: varchar('kill_name', { length: 50 }),
  notForSale: boolean('not_for_sale').default(false).notNull(),
  seatsIoStatus: varchar('seats_io_status', { length: 50 }).default('free').notNull(),
  isResale: boolean('is_resale').default(false).notNull(),
  isReservation: boolean('is_reservation').default(false).notNull(),
}, (table) => ({
  uniqueSeatIdx: uniqueIndex('unique_seat_idx').on(table.eventId, table.ticketType, table.section, table.row, table.seat),
}));

// Indirect holds table
const indirectHolds = pgTable('indirect_holds', {
  id: serial('id').primaryKey(),
  seatId: integer('seat_id').references(() => seats.id, { onDelete: 'cascade' }).notNull(),
  holdName: varchar('hold_name', { length: 50 }).notNull(),
  sourceEvent: varchar('source_event', { length: 50 }).notNull(),
});

// Indirect kills table
const indirectKills = pgTable('indirect_kills', {
  id: serial('id').primaryKey(),
  seatId: integer('seat_id').references(() => seats.id, { onDelete: 'cascade' }).notNull(),
  killName: varchar('kill_name', { length: 50 }).notNull(),
  sourceEvent: varchar('source_event', { length: 50 }).notNull(),
});

// Indirect states table (for propagated states like reserved_by_token, booked, killed)
const indirectStates = pgTable('indirect_states', {
  id: serial('id').primaryKey(),
  seatId: integer('seat_id').references(() => seats.id, { onDelete: 'cascade' }).notNull(),
  state: varchar('state', { length: 50 }).notNull(), // 'reserved_by_token', 'booked', 'killed', etc.
  sourceEvent: varchar('source_event', { length: 50 }).notNull(),
});

// State categories table
const stateCategories = pgTable('state_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  displayOrder: integer('display_order').notNull().default(0),
});

// State category memberships table
const stateCategoryMemberships = pgTable('state_category_memberships', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => stateCategories.id, { onDelete: 'cascade' }).notNull(),
  stateName: varchar('state_name', { length: 50 }).notNull(), // 'Open', 'In Cart', 'Sold', etc.
}, (table) => ({
  uniqueMembershipIdx: uniqueIndex('unique_membership_idx').on(table.categoryId, table.stateName),
}));

module.exports = {
  seats,
  indirectHolds,
  indirectKills,
  indirectStates,
  stateCategories,
  stateCategoryMemberships,
};

