# Photo Reviews Setup Instructions

## Required Dependencies

To use the Photo Reviews feature, you need to install the following dependency:

```bash
npm install sharp
```

Or with yarn:

```bash
yarn add sharp
```

## What is Sharp?

Sharp is a high-performance Node.js image processing library. It's used in the Photo Reviews feature for:

- Resizing images to maximum dimensions (1920x1920px)
- Compressing images to reduce file size
- Creating thumbnails (200x200px)
- Converting between image formats
- Optimizing image quality

## Installation Verification

After installing, verify it works:

```bash
node -e "require('sharp')"
```

If no errors appear, sharp is installed correctly.

## Type Definitions

Sharp types are included with the package, so no additional @types package is needed.

## Platform-Specific Notes

### Linux
Sharp should install without issues on most Linux distributions.

### macOS
May require Xcode Command Line Tools:
```bash
xcode-select --install
```

### Windows
May require windows-build-tools:
```bash
npm install --global windows-build-tools
```

## Alternative: Using Next.js Image Optimization

If you prefer not to use Sharp, you can modify the upload endpoint to use Next.js built-in image optimization API instead. However, Sharp provides more control and better performance.

## Files Created

1. **Library**
   - `/lib/reviews/photo-reviews.ts` - Core photo review logic

2. **Components**
   - `/components/ReviewForm.tsx` - Review form with photo upload
   - `/components/ReviewCard.tsx` - Individual review display
   - `/components/ReviewGallery.tsx` - Photo gallery with lightbox

3. **API Routes**
   - `/app/api/reviews/upload/route.ts` - Image upload endpoint
   - `/app/api/reviews/[id]/vote/route.ts` - Vote endpoint

4. **Tests**
   - `/__tests__/lib/photo-reviews.test.ts` - Unit tests

5. **Documentation**
   - `/docs/photo-reviews.md` - Feature documentation

## Next Steps

1. Install sharp: `npm install sharp`
2. Create uploads directory: `mkdir -p public/uploads/reviews`
3. Update your database schema to include review images
4. Configure CDN for uploaded images (optional but recommended)
5. Set up image moderation workflow
6. Add rate limiting to upload endpoint
7. Configure CORS if needed for different domains

## Usage Example

```tsx
import ReviewForm from '@/components/ReviewForm';
import ReviewGallery from '@/components/ReviewGallery';
import ReviewCard from '@/components/ReviewCard';

// In your product page
<ReviewForm
  productId={product.id}
  productName={product.name}
  onSubmit={handleReviewSubmit}
/>

// Display reviews
<ReviewGallery reviews={reviews} />

// Or individual cards
{reviews.map(review => (
  <ReviewCard key={review.id} review={review} />
))}
```

## Testing

Run the tests to ensure everything works:

```bash
npm test __tests__/lib/photo-reviews.test.ts
```

## Troubleshooting

### Sharp installation fails
- Make sure you have build tools installed
- Try clearing npm cache: `npm cache clean --force`
- Check Node.js version compatibility

### Images not appearing
- Check that public/uploads/reviews directory exists
- Verify file permissions
- Check Next.js static file serving configuration

### Upload endpoint returns 500
- Check server logs for detailed error
- Verify sharp is installed
- Check file system permissions

## Production Considerations

1. **Storage**: Consider using cloud storage (AWS S3, Google Cloud Storage, etc.) instead of local file system
2. **CDN**: Serve images through a CDN for better performance
3. **Backup**: Implement regular backups of uploaded images
4. **Moderation**: Set up automated or manual content moderation
5. **Rate Limiting**: Protect upload endpoints from abuse
6. **Security**: Scan uploaded files for malware
7. **Privacy**: GDPR compliance for user-uploaded content

## Support

If you encounter any issues, please check:
- Sharp documentation: https://sharp.pixelplumbing.com/
- Next.js image optimization: https://nextjs.org/docs/api-reference/next/image
- Feature documentation: /docs/photo-reviews.md
