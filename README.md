# Fieldnote — MongoDB Analytics Dashboard

A combined IoT Sensor Data Analytics and Social Media Analytics application. Built with Node.js, Express, MongoDB, and plain HTML/CSS/JavaScript. The interface uses a minimal brutalist visual language: system fonts, restrained sage/blue/ivory colors, clear borders, compact labels, and responsive layouts.

## Features

- **Workspace overview:** sensor readings, average temperature, device count, social engagement, users, and activity events.
- **IoT telemetry:** filter by device, location, and alert status; paginated readings; temperature/humidity/battery values; device-health alerts.
- **Social activity:** search captions and usernames, filter by platform, paginated post stream, likes/comments/shares, and top-engagement insights.
- **MongoDB aggregation pipelines:** date-grouped sensor trends, sensor summaries, platform engagement, latest device state, activity by event type/day, and ranked posts.
- **Indexes:** timestamp, device, location, platform, user, and activity indexes are created at application startup.
- **Seeded data:** reproducible demo dataset of 1,170 sensor readings, 10 users, 160 posts, and 600 activity events.
- **Responsive UI:** desktop top navigation switches to a compact mobile navigation; tables can scroll horizontally on small screens.
- **Deployment-friendly:** a single Express service serves both API and static frontend. No build step, Docker, external chart library, or client-side framework required.

## Requirements

- Node.js 20 or newer
- MongoDB 6.0+ (local MongoDB or a MongoDB Atlas cluster)

## Run locally (Windows PowerShell)

1. Install and start MongoDB Community Server, or create a MongoDB Atlas database.
2. Open this folder in a terminal and install dependencies:

   ```powershell
   npm install
   ```

3. Copy the environment template and edit it if needed:

   ```powershell
   Copy-Item .env.example .env
   ```

   Set `MONGODB_URI` to your connection string and optionally set `MONGODB_DB` and `PORT`. For a local MongoDB service, the defaults work when the server is listening at `127.0.0.1:27017`.

4. Seed the demo data:

   ```powershell
   npm run seed
   ```

   **Warning:** the seed script clears the `sensors`, `posts`, `users`, and `activityEvents` collections in the configured database before inserting fresh demo records. Use a dedicated demo database, not a production database.

5. Start the application:

   ```powershell
   npm start
   ```

6. Visit `http://localhost:3000`.

For development, run `npm run dev` (Node's built-in watch mode).

## Deploy to Render

This project is served as one Node web service; do not deploy the `public` folder as a separate static site.

1. Push the project folder to a GitHub repository.
2. In Render, create **New → Web Service** and connect the repository.
3. Set **Runtime** to Node, **Build Command** to `npm install`, and **Start Command** to `npm start`.
4. Add environment variables:
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `MONGODB_DB` = `fieldnote_analytics` (or another database name)
   - `NODE_ENV` = `production` (optional)
5. In MongoDB Atlas, add the Render service's outbound IP addresses to the Atlas IP access list. For initial testing, Atlas allows `0.0.0.0/0`, but it is broader than ideal; use restricted access where practical. Create a database user with only the permissions the app needs and keep its password in Render environment variables.
6. Deploy. Render supplies `PORT`; the app listens on `0.0.0.0` and that port automatically.
7. Run `npm run seed` from a trusted local terminal with the same Atlas URI/database if you want the sample dataset. Do not put database credentials in Git or frontend files.

## API reference

All endpoints return JSON. The dashboard calls these automatically.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Database ping and connection status |
| `GET /api/overview?days=7` | Summary KPIs, daily sensor averages, platform engagement and recent alerts |
| `GET /api/sensors?page=1&limit=10` | Paginated readings; optional `location`, `status=alert`, `device` |
| `GET /api/posts?page=1&limit=10` | Paginated posts; optional `platform`, `search` |
| `GET /api/activity?days=7` | Activity totals grouped by day and event type |
| `GET /api/devices/summary` | Latest measurement and historical summary for each device |
| `GET /api/insights/top-posts?limit=5` | Posts ranked by likes + comments + shares |

The `days` parameter is bounded to 1–90 days, page sizes are bounded to 5–50, and text search inputs are length-limited. The application avoids returning MongoDB connection strings or internal exception messages to clients.

## MongoDB concepts demonstrated

1. **Aggregation:** `$match`, `$group`, `$avg`, `$sum`, `$addToSet`, `$size`, `$dateToString`, `$sort`, `$limit`, `$project`, `$addFields`, and `$first`.
2. **Performance:** compound indexes aligned with common filters/sorts, bounded pagination, projections for sensor lists, and parallel independent queries.
3. **Large-data handling:** the browser receives a page rather than the full collection; summaries are computed server-side in MongoDB.
4. **Data modelling:** separate collections for sensor observations, user profiles, posts, and activity events.
5. **Replication and transactions:** these are deployment/database-topology concepts, not simulated in application code. MongoDB replica sets provide replication and are required for multi-document transactions. The dashboard uses independent reads and does not need a transaction for its seeded analytics views.

## Project structure

```text
fieldnote-mongo-analytics/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── scripts/
│   └── seed.js
├── src/
│   ├── db/mongo.js
│   ├── routes/api.js
│   └── server.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Notes

- Sample data is synthetic and intended for demos, coursework, and testing—not real operational monitoring.
- The chart is drawn with the browser canvas API, avoiding an external dependency.
- No authentication is included. Add authentication and authorization before exposing private data or write endpoints publicly.
