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
     | (photos +       |        +--------+  +--------+  +--------+
     |  thumbnails)    |<- - - - | App    |  | App    |  | App    |
     +--------^--------+ signs  | Server |  | Server |  | Server |
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

Note: the app servers only create a presigned URL (the dotted arrow). The client then uploads the photo file directly to object storage, so large files never pass through the app servers.

## 6. What each component does

- **CDN:** Solves slow photo loading for users far from our servers by keeping copies of popular photos and thumbnails at locations close to them, and takes most of the read traffic off our own servers.
- **Load balancer:** Solves the problem of one server being overloaded or failing by spreading requests across many app servers and skipping any that are unhealthy.
- **App servers:** Solve the need to run the business logic (log in, authorise uploads, build the feed) and, being stateless, can be added or removed easily as traffic changes; they stay light because file uploads bypass them.
- **Cache:** Solves slow, repeated database reads by keeping frequently requested data, such as feed pages and photo metadata, in fast memory.
- **Database (primary):** Solves the need to store structured, reliable data (users, follows, photo metadata) and handles all writes.
- **Read replica:** Solves read overload on the primary database by holding a copy of the data that serves feed queries, and acts as a backup if the primary fails.
- **Object storage:** Solves the problem of storing hundreds of terabytes of photo files cheaply and durably, and accepts uploads directly from clients via presigned URLs, which a database cannot do well.
- **Queue:** Solves slow uploads by letting the app server hand off the thumbnail job and reply immediately, and it holds jobs safely during spikes.
- **Worker:** Solves the problem of doing slow, heavy work (resizing images) away from the user's request by picking jobs from the queue and creating the thumbnails.

## 7. Upload flow

The app servers never handle the 2 MB file itself. At a peak of 50 uploads per second, that would be about 100 MB per second of file data passing through the app servers, tying up their network connections and memory. Instead, the client uploads **directly to object storage** using a **presigned URL**: a short-lived, single-use link that the app server creates and that allows one upload to one specific storage key.

1. The user picks a photo and taps upload. The app sends a small request ("I want to upload a photo", with file type and size) through the **load balancer** to an **app server**.
2. The app server checks that the user is logged in (using the shared cache or database, not its own memory) and validates the requested type and size (for example JPEG/PNG, at most 10 MB).
3. The app server generates a new photo ID and a storage key, and asks **object storage** for a **presigned upload URL** that expires in a few minutes.
4. The app server writes the photo's metadata to the **primary database** (photo ID, owner, caption, time, storage key) with status = "uploading", and returns the presigned URL to the client.
5. The client uploads the 2 MB file **directly to object storage** using that URL. The file bytes never pass through the app servers.
6. When the upload completes, object storage sends a "file created" event (or the client calls a small "upload finished" endpoint, which the app server verifies by checking that the object exists).
7. The app server (or event handler) updates the database: status = "uploaded", thumbnail status = "pending". It then puts a "create thumbnail" job on the **queue** containing the photo ID and storage key.
8. The user gets an "upload successful" response straight away and does not wait for the thumbnail.
9. A **worker** takes the job from the queue, reads the original from object storage, creates a 50 KB thumbnail, and saves it to object storage.
10. The worker updates the database (thumbnail status = "ready", thumbnail key) and clears or updates the affected cache entries, such as the followers' feed pages. The change is then copied to the **read replica**.
11. When followers scroll their feed, the photos and thumbnails load through the **CDN**. If the thumbnail is not ready yet, the app shows a placeholder.
12. **Failure handling:** if the worker fails, the job stays in the queue and is retried (with a limit, then a dead-letter queue for investigation). If a client never finishes the upload, a cleanup job deletes photos stuck in "uploading" after a set time, so no half-finished posts appear in feeds.

## 8. Trade-offs

1. **Cache speed vs. freshness.** The cache makes feeds fast and reduces database load, but cached feeds can be slightly out of date (a new photo may take seconds to appear), and we must manage invalidation. We accept this because feeds do not need to be perfectly up to date.
2. **Read replica speed vs. consistency (eventual consistency).** A read replica spreads read load, but it copies data from the primary with a small delay (replication lag), so for a moment the replica may not contain a newly published photo. A user could upload a photo and then not see it in their own feed, or a follower's feed might briefly be missing it. We accept eventual consistency for other people's feeds, because a delay of a second or two does not matter. To avoid confusing the uploader, the app reads the user's own recent photos from the primary database (or adds the new photo to their feed on the client). The feed must also tolerate a metadata row whose thumbnail is not ready yet, by showing a placeholder instead of breaking.
3. **Queue and worker: fast uploads vs. complexity and durability.** The queue makes uploads feel instant and absorbs spikes: if peak traffic (50 uploads per second) outpaces the workers, jobs wait in the queue instead of being dropped, and we add more workers. The cost is that thumbnails appear later, and the queue becomes a critical piece that must not lose jobs. We use a durable queue (jobs are stored on disk or replicated, and removed only after the worker confirms success), make the thumbnail job safe to run twice (so a retry does no harm), and add a dead-letter queue plus an alert on queue length. This adds more moving parts to run and monitor.
4. **Extra thumbnail storage vs. fast loading.** Storing a 50 KB thumbnail for each photo costs about 18 TB per year extra, but feeds load far faster and use much less bandwidth than loading 2 MB originals. This is clearly worth it.
5. **CDN cost vs. speed.** A CDN costs money and cached photos can be hard to remove quickly if a user deletes one, but it greatly reduces latency and load on our servers.
