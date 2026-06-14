const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/attendance_system');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('collections:', collections.map(c => c.name));
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'superadmin@company.com' });
    console.log('superadmin@company.com found:', !!user);
    if (user) console.log('status:', user.status, 'role:', user.role);
  } catch (err) {
    console.error('error:', err.message);
  } finally {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  }
})();
