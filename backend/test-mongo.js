const mongoose = require('mongoose');

const uri = "mongodb+srv://sk20020606_db_user:MongoDB123%40@attendance-cluster.0hmqf3u.mongodb.net/?appName=attendance-cluster";

mongoose.set('debug', true);

async function testConnection() {
  console.log("Attempting to connect to MongoDB...");
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("Successfully connected to MongoDB!");
    process.exit(0);
  } catch (error) {
    console.error("Connection failed!");
    console.error(error);
    process.exit(1);
  }
}

testConnection();
