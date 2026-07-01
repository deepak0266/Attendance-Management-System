require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    await db.collection('sessions').drop();
    console.log('Sessions collection dropped successfully.');
    process.exit(0);
  } catch (err) {
    if (err.code === 26) {
      console.log('Sessions collection does not exist.');
      process.exit(0);
    } else {
      console.error('Error dropping sessions:', err);
      process.exit(1);
    }
  }
})();
