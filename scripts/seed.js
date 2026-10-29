require('dotenv').config();
const { MongoClient } = require('mongodb');

const locations = ['North greenhouse', 'Riverside station', 'Warehouse 02', 'Campus west', 'Water treatment'];
const platforms = ['Instagram', 'X', 'LinkedIn', 'TikTok'];
const names = ['mira.chen', 'devonbuilds', 'samira_k', 'thegoodfield', 'noah.codes', 'studiofern', 'urbanobserver', 'kavya.design', 'ari_onair', 'dailybyria'];
const phrases = [
  'A small change in the process made a measurable difference.',
  'Sharing a field note from today’s experiment.',
  'What are you measuring before you make a decision?',
  'A useful reminder to look at the trend, not just one reading.',
  'New week, fresh observations, better questions.',
  'The best insights start with consistent data.',
  'Documenting what worked and what we would change next time.',
  'A quick look at the results from this week.'
];
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function randomDate(days = 30) { return new Date(Date.now() - Math.random() * days * 86400000); }

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'fieldnote_analytics');
  try {
    const sensors = db.collection('sensors');
    const posts = db.collection('posts');
    const users = db.collection('users');
    const activity = db.collection('activityEvents');
    // Repeatable seed: clear only this demo database's collections.
    await Promise.all([sensors.deleteMany({}), posts.deleteMany({}), users.deleteMany({}), activity.deleteMany({})]);

    const sensorDocs = [];
    for (let device = 1; device <= 18; device++) {
      const deviceId = `SNS-${String(device).padStart(3, '0')}`;
      for (let sample = 0; sample < 65; sample++) {
        const temperature = +(19 + Math.random() * 15 + (device % 7 === 0 ? 5 : 0)).toFixed(1);
        const battery = Math.max(5, Math.round(100 - sample * (Math.random() * 1.3) - Math.random() * 12));
        sensorDocs.push({ deviceId, location: locations[(device - 1) % locations.length], temperature, humidity: Math.round(35 + Math.random() * 53), battery, status: temperature >= 38 || battery <= 15 ? 'Alert' : 'Normal', timestamp: new Date(Date.now() - (sample * 9 + Math.random() * 8) * 3600000) });
      }
    }
    await sensors.insertMany(sensorDocs);

    const userDocs = names.map((username, i) => ({ username, displayName: username.split(/[._]/).map(s => s[0]?.toUpperCase() + s.slice(1)).join(' '), platformPreference: platforms[i % platforms.length], followers: 350 + Math.floor(Math.random() * 28000), joinedAt: randomDate(365), verified: i % 4 === 0 }));
    await users.insertMany(userDocs);
    const postDocs = Array.from({ length: 160 }, (_, i) => ({ userId: userDocs[i % userDocs.length]._id, username: userDocs[i % userDocs.length].username, platform: platforms[i % platforms.length], text: pick(phrases), likes: Math.floor(Math.random() * 2400), comments: Math.floor(Math.random() * 180), shares: Math.floor(Math.random() * 320), createdAt: randomDate(30), tags: i % 3 === 0 ? ['fieldnotes', 'insights'] : ['weeklyupdate'] }));
    await posts.insertMany(postDocs);
    const eventTypes = ['view', 'like', 'comment', 'share', 'follow', 'search'];
    const events = Array.from({ length: 600 }, (_, i) => ({ userId: userDocs[i % userDocs.length]._id, username: userDocs[i % userDocs.length].username, eventType: pick(eventTypes), platform: platforms[i % platforms.length], timestamp: randomDate(30), sessionId: `SES-${String(Math.floor(i / 3)).padStart(4, '0')}` }));
    await activity.insertMany(events);
    console.log(`Seed complete: ${sensorDocs.length} sensor readings, ${userDocs.length} users, ${postDocs.length} posts, ${events.length} activity events.`);
  } finally { await client.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
