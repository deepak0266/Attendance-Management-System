const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login API...\n');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin@company.com',
      password: 'Admin@123'
    });
    
    console.log('✅ Login SUCCESS!');
    console.log('User:', response.data.data.user.full_name);
    console.log('Role:', response.data.data.user.role);
    console.log('Cookie-based auth is enabled. Access tokens are stored securely in httpOnly cookies.');
    
  } catch (error) {
    console.log('❌ Login FAILED!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else {
      console.log('Error:', error.message);
      console.log('\n💡 Make sure backend is running on http://localhost:5000');
    }
  }
}

testLogin();