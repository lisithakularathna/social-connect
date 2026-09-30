const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/posts');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}

test();
