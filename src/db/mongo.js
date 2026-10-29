const { MongoClient } = require('mongodb');

let client;
let db;

async function connectMongo() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing. Copy .env.example to .env and configure it.');
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'fieldnote_analytics');
  await ensureIndexes(db);
  console.log(`MongoDB connected: ${db.databaseName}`);
  return db;
}

async function ensureIndexes(database) {
  await Promise.all([
    database.collection('sensors').createIndex({ deviceId: 1, timestamp: -1 }),
    database.collection('sensors').createIndex({ timestamp: -1 }),
    database.collection('sensors').createIndex({ location: 1, timestamp: -1 }),
    database.collection('posts').createIndex({ createdAt: -1 }),
    database.collection('posts').createIndex({ platform: 1, createdAt: -1 }),
    database.collection('posts').createIndex({ userId: 1, createdAt: -1 }),
    database.collection('users').createIndex({ username: 1 }, { unique: true }),
    database.collection('activityEvents').createIndex({ timestamp: -1 }),
    database.collection('activityEvents').createIndex({ userId: 1, timestamp: -1 })
  ]);
}

async function closeMongo() {
  if (client) await client.close();
  client = undefined;
  db = undefined;
}

module.exports = { connectMongo, closeMongo };
