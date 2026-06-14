require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  try {
    await db.collection('sessions').drop();
    console.log('Sessions collection dropped successfully.');
  } catch (err) {
    if (err.code === 26) {
      console.log('Sessions collection does not exist.');
    } else {
      console.error('Error dropping sessions:', err);
    }
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
