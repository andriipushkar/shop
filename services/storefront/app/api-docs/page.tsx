'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Динамічний імпорт SwaggerUI для уникнення проблем з SSR
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

/**
 * Сторінка документації API
 * Використовує Swagger UI для відображення OpenAPI специфікації
 */
export default function ApiDocsPage() {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/docs')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch API specification');
        }
        return res.json();
      })
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Завантаження документації API...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 text-lg font-semibold mb-2">Помилка завантаження</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-blue-600 text-white py-6 px-8 shadow-md">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Storefront API Documentation</h1>
          <p className="text-blue-100">
            Документація REST API для інтернет-магазину
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {spec && (
          <SwaggerUI
            spec={spec}
            docExpansion="list"
            defaultModelsExpandDepth={1}
            defaultModelExpandDepth={3}
            displayRequestDuration={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
            tryItOutEnabled={true}
          />
        )}
      </div>

      <footer className="bg-gray-100 border-t border-gray-200 py-6 px-8 mt-12">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p className="mb-2">
            <strong>Базові URL:</strong>
          </p>
          <ul className="text-sm space-y-1">
            <li>
              Development: <code className="bg-gray-200 px-2 py-1 rounded">http://localhost:3000</code>
            </li>
            <li>
              Production: <code className="bg-gray-200 px-2 py-1 rounded">https://api.example.com</code>
            </li>
          </ul>
          <p className="mt-4 text-sm">
            Для доступу до адміністративних endpoints потрібна автентифікація через JWT токен
          </p>
        </div>
      </footer>
    </div>
  );
}
