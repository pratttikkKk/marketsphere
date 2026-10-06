const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoUri = (process.env.MONGO_URI || 'mongodb://localhost:27017/marketsphere').trim();
    // Strip accidental surrounding single or double quotes from environment variables
    if ((mongoUri.startsWith('"') && mongoUri.endsWith('"')) || (mongoUri.startsWith("'") && mongoUri.endsWith("'"))) {
      mongoUri = mongoUri.slice(1, -1).trim();
    }
    const conn = await mongoose.connect(mongoUri);
    console.log('MongoDB Connected: ' + conn.connection.host);
  } catch (error) {
    console.error('Error connecting to MongoDB: ' + error.message);
    if (error.code === 'EBADNAME' || error.message.includes('EBADNAME')) {
      console.error('\n[DIAGNOSTIC] EBADNAME indicates the host in MONGO_URI is malformed.');
      console.error('[DIAGNOSTIC] Ensure your Render MONGO_URI has no unreplaced placeholders (e.g. "..."), no extra spaces, and URL-encode special characters in the password.');
    }
    process.exit(1);
  }
};

module.exports = connectDB;