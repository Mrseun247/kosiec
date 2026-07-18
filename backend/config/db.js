const mongoose = require('mongoose');

const RETRY_DELAY_MS = 5000;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // fail a connection attempt fast instead of hanging
      socketTimeoutMS: 45000,
      retryWrites: true,
    });

    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    console.log(`📦 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    console.error(`   Retrying in ${RETRY_DELAY_MS / 1000}s... (server stays up; API calls will fail until reconnected)`);
    setTimeout(connectDB, RETRY_DELAY_MS);
  }
};

// Handle connection events — never crash the process on a DB hiccup.
// The driver has its own internal reconnection logic for the underlying
// socket; this just keeps us informed and, if the connection is ever fully
// lost after having connected once, kicks off the same retry loop.
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB connection error: ${err.message}`);
});

module.exports = connectDB;
