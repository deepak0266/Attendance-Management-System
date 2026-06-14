require('dotenv').config();
const mongoose = require('mongoose');
const SystemActionLog = require('./src/models/SystemActionLog');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  const result = await SystemActionLog.deleteMany({
    action_type: 'SUPER_ADMIN_ACTION'
  });
  console.log(`Deleted ${result.deletedCount} Super Admin logs.`);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
