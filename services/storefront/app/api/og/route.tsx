import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Get parameters
  const title = searchParams.get('title') || 'TechShop';
  const subtitle = searchParams.get('subtitle') || 'Інтернет-магазин електроніки';
  const price = searchParams.get('price');
  const oldPrice = searchParams.get('oldPrice');
  const rating = searchParams.get('rating');
  const brand = searchParams.get('brand');
  const type = searchParams.get('type') || 'default'; // product, category, default

  // Calculate discount
  const discount = oldPrice && price ? Math.round((1 - Number(price) / Number(oldPrice)) * 100) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          padding: '60px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '40px',
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              T
            </div>
            <span
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              TechShop
            </span>
          </div>

          {/* Brand badge */}
          {brand && (
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                padding: '12px 24px',
                borderRadius: '999px',
                color: 'white',
                fontSize: '24px',
                fontWeight: '600',
              }}
            >
              {brand}
            </div>
          )}
        </div>

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {/* Title */}
          <h1
            style={{
              fontSize: type === 'product' ? '56px' : '72px',
              fontWeight: 'bold',
              color: 'white',
              lineHeight: 1.2,
              marginBottom: '24px',
              maxWidth: '900px',
            }}
          >
            {title}
          </h1>

          {/* Subtitle or description */}
          {subtitle && (
            <p
              style={{
                fontSize: '28px',
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '40px',
                maxWidth: '800px',
              }}
            >
              {subtitle}
            </p>
          )}

          {/* Product info row */}
          {type === 'product' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '40px',
                marginTop: '20px',
              }}
            >
              {/* Price */}
              {price && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                  <span
                    style={{
                      fontSize: '64px',
                      fontWeight: 'bold',
                      color: '#14b8a6',
                    }}
                  >
                    {Number(price).toLocaleString('uk-UA')} ₴
                  </span>
                  {oldPrice && (
                    <span
                      style={{
                        fontSize: '32px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        textDecoration: 'line-through',
                      }}
                    >
                      {Number(oldPrice).toLocaleString('uk-UA')} ₴
                    </span>
                  )}
                </div>
              )}

              {/* Discount badge */}
              {discount > 0 && (
                <div
                  style={{
                    backgroundColor: '#ef4444',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '28px',
                    fontWeight: 'bold',
                  }}
                >
                  -{discount}%
                </div>
              )}

              {/* Rating */}
              {rating && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    padding: '12px 24px',
                    borderRadius: '12px',
                  }}
                >
                  <span style={{ fontSize: '28px' }}>⭐</span>
                  <span
                    style={{
                      fontSize: '28px',
                      color: 'white',
                      fontWeight: '600',
                    }}
                  >
                    {rating}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '30px',
            marginTop: '30px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '32px',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '20px',
            }}
          >
            <span>✓ Офіційна гарантія</span>
            <span>✓ Доставка по Україні</span>
            <span>✓ Оплата частинами</span>
          </div>

          <span
            style={{
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '20px',
            }}
          >
            techshop.ua
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
