require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const departments = await db.collection('users').distinct('department');
  console.log('Distinct departments in DB:');
  console.log(JSON.stringify(departments, null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

