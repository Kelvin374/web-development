# SnapShare Scaling Plan

SnapShare is a photo-sharing app where users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions

- Registered users: 10,000,000
- Active each day: 10%
- Each active user uploads 1 photo per day
- Each active user views 50 feed pages per day
- Average photo size: 2 MB
- Thumbnail size: 50 KB (one thumbnail per photo)
- One day is about 100,000 seconds (rounded from 86,400 to make the maths easy)
- Peak traffic is 5x the average
- One year is 365 days

**Daily active users (DAU)** = 10,000,000 x 10% = **1,000,000 users per day**

## 2. Estimates

### Uploads per second

- Uploads per day = 1,000,000 users x 1 photo = 1,000,000 uploads
- Average = 1,000,000 / 100,000 = **10 uploads per second**
- Peak = 10 x 5 = **50 uploads per second**

### Feed views per second

- Feed views per day = 1,000,000 users x 50 pages = 50,000,000 views
- Average = 50,000,000 / 100,000 = **500 feed views per second**
- Peak = 500 x 5 = **2,500 feed views per second**

### Photo storage per year

- Originals per day = 1,000,000 x 2 MB = 2 TB
- Thumbnails per day = 1,000,000 x 50 KB = 50 GB
- Total per day = about 2.05 TB
- Originals per year = 2 TB x 365 = 730 TB
- Thumbnails per year = 50 GB x 365 = about 18 TB
- **Total per year = about 750 TB (0.75 PB)**

| Metric                | Average      | Peak (5x) |
| --------------------- | ------------ | --------- |
| Uploads per second    | 10           | 50        |
| Feed views per second | 500          | 2,500     |
| New storage per year  | about 750 TB | n/a       |

## 3. Read-heavy or write-heavy?

**SnapShare is read-heavy.** There are about 500 feed views per second against 10 uploads per second, a ratio of roughly 50 reads to 1 write. In reality the gap is even bigger, because each feed page shows many photos.

What this means for the design:

- Make reads fast and cheap: use a **CDN** for photos and thumbnails and a **cache** for feed data.
- Add a **read replica** so most database reads do not hit the primary database.
- Keep the write path simple, and push slow work (thumbnails) into a background queue.
- Scale the read side first, because that is where most of the traffic is.

## 4. Why photos should not be stored in the database

A 2 MB photo is a large binary file. Storing it in the database would:

- Make the database huge (about 750 TB per year), slow and expensive to back up and replicate.
- Fill up the database's memory and connections with big file transfers, slowing the small, fast queries (users, follows, captions).
- Be costly, since database storage is much more expensive than file storage.

**Where they go instead:** photos go in **object storage** (such as Amazon S3). It is cheap, nearly unlimited, durable, and made for large files. The database stores only the photo's **metadata**: the photo ID, owner, caption, time, and the URL or key pointing to the file in object storage. The CDN then serves the files from object storage.

## 5. Architecture diagram

```
                         +-----------+
                         |   Users   |
                         | (phones / |
                         |  browsers)|
                         +-----+-----+
                               |
              +----------------+-----------------+
              |                                  |
              | photo & thumbnail files          | API requests
              v                                  v
        +-----------+                    +---------------+
        |    CDN    |                    | Load Balancer |
        +-----+-----+                    +-------+-------+
              |  (cache miss)                    |
              v                      +-----------+-----------+
     +-----------------+             |           |           |
     | Object Storage  |             v           v           v
     | (photos +       |        +--------+   +--------+  +--------+
     |  thumbnails)    |<-------| App     |   | App    |  | App     |
     +--------^--------+ upload | Server0 |  | Server1 |  | Server2 |
              |                 +---+----+  +---+----+  +---+----+
              |                     |           |           |
              |        +------------+-----------+-----------+
              |        |            |                       |
              |        v            v                       v
              |   +---------+  +-----------+        +-------------+
              |   |  Cache  |  | Database  |------->| Read Replica|
              |   | (feeds, |  | (primary) | copies | (feed reads)|
              |   | metadata)| | (writes)  | data   +-------------+
              |   +---------+  +-----------+
              |                     ^
              |                     | update thumbnail URL
              |                +----+-----+      +----------+
              |                |  Worker  |<-----|  Queue   |
              +----------------| (makes   | job  | (thumb-  |
                 saves         | thumbs)  |      |  nail    |
                 thumbnail     +----------+      |  jobs)   |
                                                 +----^-----+
                                                      |
                                           App server adds job
                                             (from the upload)
```

## 6. What each component does

- **CDN:** Solves slow photo loading for users far from our servers by keeping copies of popular photos and thumbnails at locations close to them, and takes most of the read traffic off our own servers.
- **Load balancer:** Solves the problem of one server being overloaded or failing by spreading requests across many app servers and skipping any that are unhealthy.
- **App servers:** Solve the need to run the business logic (log in, upload, build the feed) and, being stateless, can be added or removed easily as traffic changes.
- **Cache:** Solves slow, repeated database reads by keeping frequently requested data, such as feed pages and photo metadata, in fast memory.
- **Database (primary):** Solves the need to store structured, reliable data (users, follows, photo metadata) and handles all writes.
- **Read replica:** Solves read overload on the primary database by holding a copy of the data that serves feed queries, and acts as a backup if the primary fails.
- **Object storage:** Solves the problem of storing hundreds of terabytes of photo files cheaply and durably, which a database cannot do well.
- **Queue:** Solves slow uploads by letting the app server hand off the thumbnail job and reply immediately, and it holds jobs safely during spikes.
- **Worker:** Solves the problem of doing slow, heavy work (resizing images) away from the user's request by picking jobs from the queue and creating the thumbnails.

## 7. Upload flow

1. The user picks a photo in the app and taps upload.
2. The request goes through the **load balancer**, which sends it to one of the **app servers**.
3. The app server checks that the user is logged in (using the shared cache or database, not its own memory) and validates the file (type and size).
4. The app server saves the original 2 MB photo to **object storage** and gets back its storage key.
5. The app server writes the photo's metadata (ID, owner, caption, time, storage key, thumbnail status = "pending") to the **primary database**.
6. The app server puts a "create thumbnail" job on the **queue**, containing the photo ID and storage key.
7. The app server replies "upload successful" to the user straight away. The user does not wait for the thumbnail.
8. A **worker** takes the job from the queue, reads the original from object storage, and creates a 50 KB thumbnail.
9. The worker saves the thumbnail to object storage and updates the database (thumbnail status = "ready", thumbnail key).
10. The relevant cache entries (for example the followers' feeds) are updated or cleared, and the data is copied to the **read replica**.
11. When followers scroll their feed, they get the thumbnail and photo through the **CDN**. If the thumbnail is not ready yet, the app shows a placeholder or the original.
12. If the worker fails, the job stays in the queue and is retried, so no thumbnail is lost.

## 8. Trade-offs

1. **Cache speed vs. freshness.** The cache makes feeds fast and reduces database load, but cached feeds can be slightly out of date (a new photo may take seconds to appear), and we must manage invalidation. We accept this because feeds do not need to be perfectly up to date.
2. **Read replica speed vs. consistency.** A read replica spreads read load, but it copies data with a small delay (replication lag), so a user might not see their own new photo immediately if the feed reads from the replica. We can read the user's own recent uploads from the primary to reduce this.
3. **Queue and worker: fast uploads vs. complexity.** The queue makes uploads feel instant and handles spikes, but thumbnails appear a little later, and we must run, monitor and retry the worker and handle failed jobs. This adds more moving parts.
4. **Extra thumbnail storage vs. fast loading.** Storing a 50 KB thumbnail for each photo costs about 18 TB per year extra, but feeds load far faster and use much less bandwidth than loading 2 MB originals. This is clearly worth it.
5. **CDN cost vs. speed.** A CDN costs money and cached photos can be hard to remove quickly if a user deletes one, but it greatly reduces latency and load on our servers.
