require('dotenv').config();
const { db, seats } = require('./index');
const { eq } = require('drizzle-orm');

const eventIds = ['season', 'packageA', 'packageB', 'event1', 'event2', 'event3'];
const sections = ['101', '102', '103', '104'];
const rows = ['A', 'B', 'C', 'D', 'E'];
const seatNumbers = [1, 2, 3, 4, 5];

// Section 101 and 102 belong to ticket type "Top"
// Section 103 and 104 belong to ticket type "Bottom "
const getTicketType = (section) => {
  return ['101', '102'].includes(section) ? 'Top' : 'Bottom ';
};

async function seed() {
  console.log('Starting database seed...');
  
  try {
    // Clear existing seats
    await db.delete(seats);
    console.log('Cleared existing seats');
    
    const seatsToInsert = [];
    
    // Generate seats for each event
    for (const eventId of eventIds) {
      for (const section of sections) {
        const ticketType = getTicketType(section);
        for (const row of rows) {
          for (const seat of seatNumbers) {
            seatsToInsert.push({
              eventId,
              ticketType,
              section,
              row,
              seat,
              seatingType: 'Row',
              directHoldName: null,
              killName: null,
              notForSale: false,
              seatsIoStatus: 'free',
              isResale: false,
              isReservation: false,
            });
          }
        }
      }
    }
    
    // Insert in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < seatsToInsert.length; i += batchSize) {
      const batch = seatsToInsert.slice(i, i + batchSize);
      await db.insert(seats).values(batch);
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(seatsToInsert.length / batchSize)}`);
    }
    
    console.log(`Successfully seeded ${seatsToInsert.length} seats`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();

