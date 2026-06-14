require('dotenv').config();
const mongoose = require('mongoose');
const GeoFence = require('./src/models/GeoFence');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const existingCount = await GeoFence.countDocuments();
  
  if (existingCount > 0) {
    // Update all existing geofences
    const result = await GeoFence.updateMany({}, {
      $set: {
        center: {
          latitude: 28.3978557,
          longitude: 77.0439452
        },
        radius: 400,
        status: 'ACTIVE'
      }
    });
    console.log(`Updated ${result.modifiedCount} geofences.`);
  } else {
    // Create a default global geofence
    await GeoFence.create({
      name: 'Main Office Branch',
      description: 'Primary office location',
      center: {
        latitude: 28.3978557,
        longitude: 77.0439452
      },
      radius: 400,
      status: 'ACTIVE'
    });
    console.log('Created default Main Office Branch geofence.');
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
