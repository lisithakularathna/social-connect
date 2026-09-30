const axios = require('axios');

async function testLogin() {
  try {
    const res = await axios.post('http://localhost:3000/auth/login', {
      email: 'lisitha@gmail.com',
      password: '123456'
    });
    console.log("Success:", res.data);
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}

testLogin();
