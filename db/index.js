const { drizzle } = require('drizzle-orm/node-postgres');
const pool = require('./config');
const { seats, indirectHolds, indirectKills, indirectStates } = require('./schema');

const db = drizzle(pool, { schema: { seats, indirectHolds, indirectKills, indirectStates } });

module.exports = {
  db,
  seats,
  indirectHolds,
  indirectKills,
  indirectStates,
};

