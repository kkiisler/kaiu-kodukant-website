const bcrypt = require('bcrypt');

const password = 'Juhatus2025';
const storedHash = '$2b$10$96kWvEcT30kPgOejkxtQFOgZEaK4chMZc6LxQCidfhjgqPoO9AESe';

// Test the password
bcrypt.compare(password, storedHash).then(result => {
  console.log('Password "Juhatus2025" matches hash:', result);

  // If it doesn't match, generate the correct hash
  if (!result) {
    bcrypt.hash(password, 10).then(hash => {
      console.log('\nCorrect hash for "Juhatus2025":');
      console.log(hash);
      console.log('\nAdd this to your .env file:');
      console.log(`ADMIN_PASSWORD_HASH=${hash}`);
    });
  }
});