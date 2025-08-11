const fetch = require('node-fetch');

async function testLogin() {
  try {
    console.log('Testing login...');
    
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@blog.com',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    console.log('Login response:', data);
    
    if (data.success && data.data.token) {
      console.log('\nTesting articles API with token...');
      
      const articlesResponse = await fetch('http://localhost:3001/api/articles/stats', {
        headers: {
          'Authorization': `Bearer ${data.data.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const articlesData = await articlesResponse.json();
      console.log('Articles stats response:', articlesData);
      
      const myArticlesResponse = await fetch(`http://localhost:3001/api/articles?author=${data.data.user.id}&page=1&limit=10&sortBy=updated_at&sortOrder=desc`, {
        headers: {
          'Authorization': `Bearer ${data.data.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const myArticlesData = await myArticlesResponse.json();
      console.log('My articles response:', myArticlesData);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testLogin();