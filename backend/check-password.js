const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function checkPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to DB\n');
    
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ email: 'superadmin@company.com' });
    
    if (!user) {
      console.log('❌ User not found!');
      process.exit(1);
    }
    
    console.log('User found:', user.email);
    
    const isValid = await bcrypt.compare('Admin@123', user.password_hash);
    console.log('Password valid:', isValid);
    
    if (!isValid) {
      console.log('\nResetting password...');
      const hash = await bcrypt.hash('Admin@123', 12);
      await db.collection('users').updateOne(
        { email: 'superadmin@company.com' },
        { $set: { password_hash: hash } }
      );
      console.log('✅ Password reset to: Admin@123');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkPassword();