# Photo Reviews Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE (Browser)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────┐    ┌─────────────────┐    ┌──────────────────┐ │
│  │  ReviewForm    │    │  ReviewCard     │    │  ReviewGallery   │ │
│  │                │    │                 │    │                  │ │
│  │ - Star rating  │    │ - User info     │    │ - Photo grid     │ │
│  │ - Text fields  │    │ - Photos        │    │ - Lightbox       │ │
│  │ - Pros/Cons    │    │ - Pros/Cons     │    │ - Filter toggle  │ │
│  │ - Photo upload │    │ - Voting        │    │ - Navigation     │ │
│  │ - Drag & Drop  │    │ - Badges        │    │                  │ │
│  └────────┬───────┘    └────────┬────────┘    └────────┬─────────┘ │
│           │                     │                       │           │
│           └─────────────────────┴───────────────────────┘           │
│                                 │                                   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
          ┌────────▼────────┐         ┌─────────▼─────────┐
          │   /lib/reviews/ │         │    /lib/reviews.ts │
          │ photo-reviews.ts│         │                    │
          │                 │         │ - submitReview()   │
          │ - validateImage │         │ - voteReview()     │
          │ - compressImage │         │ - filterReviews()  │
          │ - uploadImage   │         │ - calculateSummary │
          │ - processBatch  │         │                    │
          └────────┬────────┘         └─────────┬──────────┘
                   │                            │
                   └──────────────┬─────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────┐
│                            SERVER SIDE                               │
├─────────────────────────────────┴───────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      API Routes (Next.js)                     │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                               │  │
│  │  ┌─────────────────────────┐    ┌──────────────────────────┐│  │
│  │  │ POST /api/reviews/upload│    │ POST /api/reviews/[id]/ ││  │
│  │  │                         │    │        vote              ││  │
│  │  │ 1. Validate file        │    │                          ││  │
│  │  │ 2. Process with Sharp   │    │ 1. Check user vote       ││  │
│  │  │ 3. Create thumbnail     │    │ 2. Update vote count     ││  │
│  │  │ 4. Save to filesystem   │    │ 3. Cache in Redis        ││  │
│  │  │ 5. Return URLs          │    │ 4. Return new counts     ││  │
│  │  └────────┬────────────────┘    └────────┬─────────────────┘│  │
│  │           │                               │                  │  │
│  └───────────┼───────────────────────────────┼──────────────────┘  │
│              │                               │                     │
│  ┌───────────▼───────────┐      ┌───────────▼─────────┐          │
│  │    Sharp Library      │      │    Redis Cache      │          │
│  │                       │      │                     │          │
│  │ - resize(1920x1920)   │      │ - Vote tracking     │          │
│  │ - compress(85%)       │      │ - User votes        │          │
│  │ - thumbnail(200x200)  │      │ - Vote counts       │          │
│  │ - format conversion   │      │ - TTL: 30 days      │          │
│  └───────────┬───────────┘      └───────────┬─────────┘          │
│              │                               │                     │
│  ┌───────────▼───────────────────────────────▼─────────┐          │
│  │              File System / Cloud Storage             │          │
│  │                                                      │          │
│  │  /public/uploads/reviews/                           │          │
│  │  ├── {uuid}.jpg          (main image)               │          │
│  │  └── {uuid}_thumb.jpg    (thumbnail)                │          │
│  │                                                      │          │
│  │  Future: AWS S3, Google Cloud Storage, etc.         │          │
│  └──────────────────────────────────────────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Photo Upload Flow

```
User selects images
       │
       ▼
[Client-side validation]
       │
       ├─ Check file type (jpg/png/webp)
       ├─ Check file size (< 10MB)
       └─ Check count (≤ 5 images)
       │
       ▼
[Client-side compression]
       │
       ├─ Load image in canvas
       ├─ Resize to max 1920x1920
       └─ Compress to 85% quality
       │
       ▼
[Upload to server]
       │
       └─ POST /api/reviews/upload
              │
              ▼
      [Server-side processing]
              │
              ├─ Validate again
              ├─ Process with Sharp
              ├─ Create thumbnail
              └─ Save files
              │
              ▼
      [Return URLs]
              │
              └─ { url, thumbnailUrl, id, ... }
       │
       ▼
[Display preview]
       │
       └─ Show in ReviewForm
```

### Review Submit Flow

```
User fills form + uploads photos
       │
       ▼
[Validate form data]
       │
       ├─ Rating (1-5)
       ├─ Title (required)
       ├─ Content (required)
       ├─ Pros/Cons (optional)
       └─ Photos (0-5)
       │
       ▼
[Submit review]
       │
       └─ submitReview(data)
              │
              ▼
      [Create FormData]
              │
              ├─ Add text fields
              └─ Add image files
              │
              ▼
      [POST /api/reviews]
              │
              ▼
      [Save to database]
              │
              ├─ Create review record
              ├─ Create media records
              └─ Set status: pending
              │
              ▼
      [Return new review]
       │
       ▼
[Update UI]
       │
       ├─ Close form
       ├─ Show success message
       └─ Add to reviews list
```

### Vote Flow

```
User clicks "Helpful" or "Not helpful"
       │
       ▼
[Check if already voted]
       │
       ├─ Check local state
       └─ Check server cache
       │
       ▼
[Send vote]
       │
       └─ POST /api/reviews/[id]/vote
              │
              ├─ Get user identifier (IP)
              ├─ Check existing vote
              ├─ Update vote count
              └─ Cache in Redis
              │
              ▼
      [Return new counts]
       │
       ▼
[Update UI]
       │
       ├─ Highlight button
       └─ Update counters
```

## Component Hierarchy

```
ProductReviewsPage (Example)
│
├── ReviewForm
│   ├── Star rating component
│   ├── Text inputs
│   ├── Pros/Cons fields
│   └── Photo upload zone
│       ├── Drag & drop area
│       ├── File input
│       └── Image previews
│
├── Review Summary
│   ├── RatingStars
│   ├── Rating distribution bars
│   └── Statistics
│
├── Filter Controls
│   ├── Sort dropdown
│   └── Filter buttons
│
└── Reviews Display
    │
    ├── ReviewGallery (if filter: photosOnly)
    │   ├── Photo grid
    │   └── Lightbox modal
    │       ├── Full-size image
    │       ├── Navigation buttons
    │       └── Image info
    │
    └── ReviewCard list (default)
        ├── User avatar/name
        ├── Rating stars
        ├── Review content
        ├── Pros/Cons badges
        ├── Photo thumbnails
        ├── Vote buttons
        └── Seller response
```

## State Management

### ReviewForm State
```typescript
{
  rating: number,
  title: string,
  content: string,
  pros: string[],
  cons: string[],
  images: ImagePreview[],
  uploadProgress: Record<number, number>,
  isUploading: boolean,
  isSubmitting: boolean,
  error: string
}
```

### ReviewCard State
```typescript
{
  isVoting: boolean,
  userVote: 'helpful' | 'not_helpful' | null,
  votes: {
    helpful: number,
    notHelpful: number
  }
}
```

### ReviewGallery State
```typescript
{
  lightboxOpen: boolean,
  currentImageIndex: number,
  images: LightboxImage[],
  photosOnlyFilter: boolean
}
```

## Security Measures

1. **File Validation**
   - Type check (MIME type)
   - Size limit (10MB)
   - Count limit (5 images)
   - Extension validation

2. **Server-side Processing**
   - Re-validate all files
   - Sanitize filenames
   - Generate unique IDs
   - Store in isolated directory

3. **Access Control**
   - IP-based vote tracking
   - Rate limiting (recommended)
   - CORS configuration
   - Authentication (for production)

4. **Data Validation**
   - Input sanitization
   - SQL injection prevention
   - XSS protection
   - CSRF tokens (recommended)

## Performance Optimizations

1. **Image Processing**
   - Client-side pre-compression
   - Server-side optimization with Sharp
   - Lazy loading thumbnails
   - Progressive JPEG encoding

2. **Caching Strategy**
   - Vote counts in Redis (30 days)
   - Static images served from CDN
   - Browser caching headers
   - Service worker caching (future)

3. **Bundle Size**
   - Code splitting
   - Lazy component loading
   - Tree shaking
   - Compression (gzip/brotli)

## Monitoring & Logging

```typescript
// API Logger events
{
  'review.image.uploaded': { fileId, size, duration },
  'review.vote.recorded': { reviewId, voteType, userId },
  'review.image.failed': { error, fileSize, fileType },
  'review.vote.duplicate': { reviewId, userId }
}
```

## Future Enhancements

1. **AI Integration**
   - Auto-moderation
   - Inappropriate content detection
   - Face detection & blur
   - Duplicate image detection

2. **Advanced Features**
   - Video reviews
   - Before/after comparisons
   - 360° product photos
   - AR preview

3. **Analytics**
   - Photo engagement metrics
   - Conversion rate by reviews with photos
   - Most helpful reviewers
   - Quality score for photos

4. **Social Features**
   - Share reviews on social media
   - Photo contests
   - Reviewer profiles
   - Follow reviewers
