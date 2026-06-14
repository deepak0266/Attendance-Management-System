const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
console.log('Testing URI:', uri);

async function test() {
  try {
    console.log('Testing with default options...');
    await mongoose.connect(uri);
    console.log('Success with default options!');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error with default options:', err.message);
    
    try {
      console.log('Testing without family option or anything...');
      await mongoose.connect(uri, { family: 4 });
      console.log('Success with family: 4!');
      await mongoose.disconnect();
    } catch (err2) {
      console.error('Error with family 4:', err2.message);
    }
  }
}

test();
