const { drizzle } = require('drizzle-orm/node-postgres');
const pool = require('./config');
const { seats, indirectHolds, indirectKills, indirectStates, stateCategories, stateCategoryMemberships } = require('./schema');

const db = drizzle(pool, { schema: { seats, indirectHolds, indirectKills, indirectStates, stateCategories, stateCategoryMemberships } });

module.exports = {
  db,
  seats,
  indirectHolds,
  indirectKills,
  indirectStates,
  stateCategories,
  stateCategoryMemberships,
};

