const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./blog.db');

db.all('SELECT id, email, username FROM users', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Users in database:');
    rows.forEach(user => {
      console.log(`ID: ${user.id}, Email: ${user.email}, Username: ${user.username}`);
    });
  }
  db.close();
});