const mongoose = require('mongoose');

const uri = "mongodb+srv://sk20020606_db_user:MongoDB123%40@attendance-cluster.0hmqf3u.mongodb.net/?appName=attendance-cluster";

async function fixShifts() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");
    
    const db = mongoose.connection.db;
    
    // Check if user exists
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users.`);
    
    // Update all users who don't have a valid department
    const validDepartments = [
      'Engineering', 'Marketing', 'Sales', 'IT', 'Administration', 
      'Product', 'Quality Assurance', 'Operations', 'Customer Support',
      'Management', 'Human Resources', 'Finance'
    ];
    
    let updated = 0;
    for (let user of users) {
      if (!user.department || !validDepartments.includes(user.department)) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { department: 'Engineering' } }
        );
        updated++;
      }
    }
    console.log(`Updated ${updated} users to 'Engineering' department so they get General Shift.`);
    
    // Optional: make General shift apply to everyone by removing department restrictions
    // This guarantees everyone gets a shift if department logic fails
    await db.collection('shifts').updateOne(
      { name: 'General Shift' },
      { $set: { applicable_departments: [], applicable_users: [] } }
    );
    console.log(`Updated 'General Shift' to be a global shift (applies to everyone).`);
    
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log("Disconnected.");
  }
}

fixShifts();
