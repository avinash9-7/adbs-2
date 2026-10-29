const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

const safeInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const dateRange = (range) => {
  const days = safeInt(range, 7, 1, 90);
  return { $gte: new Date(Date.now() - days * 86400000) };
};
const collection = (req, name) => req.app.locals.db.collection(name);

router.get('/health', async (req, res) => {
  try {
    await req.app.locals.db.command({ ping: 1 });
    res.json({ ok: true, database: req.app.locals.db.databaseName, timestamp: new Date().toISOString() });
  } catch (error) { res.status(503).json({ ok: false, error: 'Database unavailable' }); }
});

router.get('/overview', async (req, res, next) => {
  try {
    const days = safeInt(req.query.days, 7, 1, 90);
    const since = dateRange(days);
    const [sensorStats, postStats, userCount, activityCount, sensorSeries, platformStats, recentAlerts] = await Promise.all([
      collection(req, 'sensors').aggregate([
        { $match: { timestamp: since } },
        { $group: {
          _id: null,
          readings: { $sum: 1 },
          avgTemperature: { $avg: '$temperature' },
          avgHumidity: { $avg: '$humidity' },
          avgBattery: { $avg: '$battery' },
          devices: { $addToSet: '$deviceId' },
          critical: { $sum: { $cond: [{ $or: [{ $gte: ['$temperature', 38] }, { $lte: ['$battery', 15] }] }, 1, 0] } }
        } },
        { $project: { _id: 0, readings: 1, avgTemperature: { $round: ['$avgTemperature', 1] }, avgHumidity: { $round: ['$avgHumidity', 1] }, avgBattery: { $round: ['$avgBattery', 0] }, devices: { $size: '$devices' }, critical: 1 } }
      ]).toArray(),
      collection(req, 'posts').aggregate([
        { $match: { createdAt: since } },
        { $group: { _id: null, posts: { $sum: 1 }, likes: { $sum: '$likes' }, comments: { $sum: '$comments' }, shares: { $sum: '$shares' }, engagement: { $sum: { $add: ['$likes', '$comments', '$shares'] } } } },
        { $project: { _id: 0, posts: 1, likes: 1, comments: 1, shares: 1, engagement: 1 } }
      ]).toArray(),
      collection(req, 'users').countDocuments(),
      collection(req, 'activityEvents').countDocuments({ timestamp: since }),
      collection(req, 'sensors').aggregate([
        { $match: { timestamp: since } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, temperature: { $avg: '$temperature' }, humidity: { $avg: '$humidity' }, readings: { $sum: 1 } } },
        { $sort: { _id: 1 } }, { $project: { _id: 0, date: '$_id', temperature: { $round: ['$temperature', 1] }, humidity: { $round: ['$humidity', 1] }, readings: 1 } }
      ]).toArray(),
      collection(req, 'posts').aggregate([
        { $match: { createdAt: since } },
        { $group: { _id: '$platform', posts: { $sum: 1 }, engagement: { $sum: { $add: ['$likes', '$comments', '$shares'] } } } },
        { $sort: { engagement: -1 } }, { $project: { _id: 0, platform: '$_id', posts: 1, engagement: 1 } }
      ]).toArray(),
      collection(req, 'sensors').aggregate([
        { $match: { timestamp: since, $or: [{ temperature: { $gte: 38 } }, { battery: { $lte: 15 } }, { humidity: { $gte: 88 } }] } },
        { $sort: { timestamp: -1 } }, { $limit: 5 },
        { $project: { _id: 0, deviceId: 1, location: 1, temperature: 1, humidity: 1, battery: 1, timestamp: 1 } }
      ]).toArray()
    ]);
    res.json({ days, sensors: sensorStats[0] || { readings: 0, avgTemperature: 0, avgHumidity: 0, avgBattery: 0, devices: 0, critical: 0 }, social: { ...(postStats[0] || { posts: 0, likes: 0, comments: 0, shares: 0, engagement: 0 }), users: userCount, activityEvents: activityCount }, sensorSeries, platformStats, recentAlerts });
  } catch (error) { next(error); }
});

router.get('/sensors', async (req, res, next) => {
  try {
    const page = safeInt(req.query.page, 1, 1, 1000000);
    const limit = safeInt(req.query.limit, 10, 5, 50);
    const filter = {};
    if (req.query.location && req.query.location !== 'all') filter.location = req.query.location;
    if (req.query.status === 'alert') filter.$or = [{ temperature: { $gte: 38 } }, { battery: { $lte: 15 } }, { humidity: { $gte: 88 } }];
    if (req.query.device) filter.deviceId = { $regex: String(req.query.device).slice(0, 40), $options: 'i' };
    const [items, total, locations] = await Promise.all([
      collection(req, 'sensors').find(filter, { projection: { _id: 1, deviceId: 1, location: 1, temperature: 1, humidity: 1, battery: 1, status: 1, timestamp: 1 } }).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      collection(req, 'sensors').countDocuments(filter),
      collection(req, 'sensors').distinct('location')
    ]);
    res.json({ items, page, limit, total, pages: Math.ceil(total / limit), locations });
  } catch (error) { next(error); }
});

router.get('/posts', async (req, res, next) => {
  try {
    const page = safeInt(req.query.page, 1, 1, 1000000);
    const limit = safeInt(req.query.limit, 10, 5, 50);
    const filter = {};
    if (req.query.platform && req.query.platform !== 'all') filter.platform = req.query.platform;
    if (req.query.search) filter.$or = [
      { text: { $regex: String(req.query.search).slice(0, 60), $options: 'i' } },
      { username: { $regex: String(req.query.search).slice(0, 40), $options: 'i' } }
    ];
    const [items, total, platforms] = await Promise.all([
      collection(req, 'posts').find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      collection(req, 'posts').countDocuments(filter), collection(req, 'posts').distinct('platform')
    ]);
    res.json({ items, page, limit, total, pages: Math.ceil(total / limit), platforms });
  } catch (error) { next(error); }
});

router.get('/activity', async (req, res, next) => {
  try {
    const days = safeInt(req.query.days, 7, 1, 90);
    const rows = await collection(req, 'activityEvents').aggregate([
      { $match: { timestamp: dateRange(days) } },
      { $group: { _id: { event: '$eventType', day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } } }, count: { $sum: 1 } } },
      { $sort: { '_id.day': 1, count: -1 } },
      { $group: { _id: '$_id.day', total: { $sum: '$count' }, events: { $push: { type: '$_id.event', count: '$count' } } } },
      { $sort: { _id: 1 } }, { $project: { _id: 0, date: '$_id', total: 1, events: 1 } }
    ]).toArray();
    res.json({ days, items: rows });
  } catch (error) { next(error); }
});

router.get('/devices/summary', async (req, res, next) => {
  try {
    const items = await collection(req, 'sensors').aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$deviceId', latest: { $first: '$$ROOT' }, readings: { $sum: 1 }, averageTemperature: { $avg: '$temperature' } } },
      { $project: { _id: 0, deviceId: '$_id', location: '$latest.location', temperature: '$latest.temperature', humidity: '$latest.humidity', battery: '$latest.battery', timestamp: '$latest.timestamp', readings: 1, averageTemperature: { $round: ['$averageTemperature', 1] }, status: { $cond: [{ $or: [{ $gte: ['$latest.temperature', 38] }, { $lte: ['$latest.battery', 15] }] }, 'Alert', 'Normal'] } } },
      { $sort: { timestamp: -1 } }, { $limit: 100 }
    ]).toArray();
    res.json({ items });
  } catch (error) { next(error); }
});

router.get('/insights/top-posts', async (req, res, next) => {
  try {
    const limit = safeInt(req.query.limit, 5, 1, 20);
    const items = await collection(req, 'posts').aggregate([
      { $addFields: { engagement: { $add: ['$likes', '$comments', '$shares'] } } },
      { $sort: { engagement: -1, createdAt: -1 } }, { $limit: limit },
      { $project: { _id: 1, username: 1, platform: 1, text: 1, likes: 1, comments: 1, shares: 1, engagement: 1, createdAt: 1 } }
    ]).toArray();
    res.json({ items });
  } catch (error) { next(error); }
});

module.exports = router;
