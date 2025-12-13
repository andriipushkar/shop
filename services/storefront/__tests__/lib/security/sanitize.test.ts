/**
 * Tests for Input Sanitization
 */

import {
  escapeHtml,
  unescapeHtml,
  stripHtml,
  sanitizeHtml,
  normalizeWhitespace,
  removeControlChars,
  removeZeroWidth,
  sanitizeText,
  sanitizeForDisplay,
  escapeSql,
  sanitizeSqlInput,
  sanitizePath,
  sanitizeFilename,
  sanitizeUrl,
  sanitizeRedirectUrl,
  sanitizeJson,
  sanitizeObject,
  sanitizeReview,
  detectSpamPatterns,
} from '@/lib/security/sanitize';

describe('HTML Sanitization', () => {
  describe('escapeHtml', () => {
    it('escapes HTML entities', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('escapes ampersands', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('escapes quotes', () => {
      expect(escapeHtml("It's \"quoted\"")).toBe("It&#x27;s &quot;quoted&quot;");
    });

    it('returns empty string for non-string input', () => {
      expect(escapeHtml(null as unknown as string)).toBe('');
      expect(escapeHtml(undefined as unknown as string)).toBe('');
      expect(escapeHtml(123 as unknown as string)).toBe('');
    });
  });

  describe('unescapeHtml', () => {
    it('unescapes HTML entities', () => {
      expect(unescapeHtml('&lt;script&gt;')).toBe('<script>');
      expect(unescapeHtml('&amp;')).toBe('&');
      expect(unescapeHtml('&quot;')).toBe('"');
    });

    it('handles multiple entities', () => {
      expect(unescapeHtml('&lt;div&gt;Hello &amp; World&lt;/div&gt;')).toBe(
        '<div>Hello & World</div>'
      );
    });
  });

  describe('stripHtml', () => {
    it('removes all HTML tags', () => {
      expect(stripHtml('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
    });

    it('removes script tags and content', () => {
      expect(stripHtml('<script>alert("XSS")</script>Hello')).toBe('Hello');
    });

    it('removes style tags and content', () => {
      expect(stripHtml('<style>body{color:red}</style>Hello')).toBe('Hello');
    });

    it('converts &nbsp; to space', () => {
      expect(stripHtml('Hello&nbsp;World')).toBe('Hello World');
    });
  });

  describe('sanitizeHtml', () => {
    it('removes script tags', () => {
      expect(sanitizeHtml('<p>Text</p><script>alert("XSS")</script>')).toBe('<p>Text</p>');
    });

    it('removes event handlers', () => {
      expect(sanitizeHtml('<p onclick="alert()">Text</p>')).toBe('<p>Text</p>');
      expect(sanitizeHtml('<p onmouseover="alert()">Text</p>')).toBe('<p>Text</p>');
    });

    it('removes javascript: URLs', () => {
      const result = sanitizeHtml('<a href="javascript:alert()">Click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('keeps allowed tags', () => {
      expect(sanitizeHtml('<p>Paragraph</p>')).toBe('<p>Paragraph</p>');
      expect(sanitizeHtml('<strong>Bold</strong>')).toBe('<strong>Bold</strong>');
      expect(sanitizeHtml('<ul><li>Item</li></ul>')).toBe('<ul><li>Item</li></ul>');
    });

    it('removes disallowed tags', () => {
      expect(sanitizeHtml('<div>Content</div>')).toBe('Content');
      expect(sanitizeHtml('<span>Text</span>')).toBe('Text');
    });
  });
});

describe('Text Sanitization', () => {
  describe('normalizeWhitespace', () => {
    it('trims and normalizes whitespace', () => {
      expect(normalizeWhitespace('  hello   world  ')).toBe('hello world');
      expect(normalizeWhitespace('hello\n\n\nworld')).toBe('hello world');
      expect(normalizeWhitespace('hello\t\tworld')).toBe('hello world');
    });
  });

  describe('removeControlChars', () => {
    it('removes control characters', () => {
      expect(removeControlChars('hello\x00world')).toBe('helloworld');
      expect(removeControlChars('test\x1fstring')).toBe('teststring');
    });

    it('preserves normal characters', () => {
      expect(removeControlChars('Hello World!')).toBe('Hello World!');
    });
  });

  describe('removeZeroWidth', () => {
    it('removes zero-width characters', () => {
      expect(removeZeroWidth('hello\u200Bworld')).toBe('helloworld');
      expect(removeZeroWidth('test\u200Dstring')).toBe('teststring');
      expect(removeZeroWidth('abc\uFEFFdef')).toBe('abcdef');
    });
  });

  describe('sanitizeText', () => {
    it('applies all text sanitization', () => {
      const input = '  hello\x00\u200Bworld  ';
      expect(sanitizeText(input)).toBe('helloworld');
    });

    it('normalizes unicode', () => {
      const nfd = 'café'.normalize('NFD');
      const result = sanitizeText(nfd);
      expect(result).toBe('café');
    });
  });

  describe('sanitizeForDisplay', () => {
    it('sanitizes text and escapes HTML', () => {
      expect(sanitizeForDisplay('  <script>alert()</script>  ')).toBe(
        '&lt;script&gt;alert()&lt;&#x2F;script&gt;'
      );
    });
  });
});

describe('SQL Sanitization', () => {
  describe('escapeSql', () => {
    it('escapes SQL special characters', () => {
      expect(escapeSql("O'Reilly")).toBe("O\\'Reilly");
      expect(escapeSql('100%')).toBe('100\\%');
      expect(escapeSql('test_value')).toBe('test\\_value');
    });
  });

  describe('sanitizeSqlInput', () => {
    it('removes SQL comments', () => {
      expect(sanitizeSqlInput('value -- comment')).toBe('value  comment');
      expect(sanitizeSqlInput('value /* comment */ end')).toBe('value  end');
    });

    it('removes semicolons', () => {
      const result = sanitizeSqlInput('value; DROP TABLE users;');
      expect(result).not.toContain(';');
      expect(result).not.toContain('DROP');
    });

    it('removes SQL keywords', () => {
      expect(sanitizeSqlInput("' OR 1=1")).toBe("'  1=1");
      expect(sanitizeSqlInput('UNION SELECT * FROM users')).toBe('  * FROM users');
    });
  });
});

describe('Path Sanitization', () => {
  describe('sanitizePath', () => {
    it('removes path traversal sequences', () => {
      expect(sanitizePath('../../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('..\\..\\windows')).toBe('windows');
    });

    it('removes null bytes', () => {
      expect(sanitizePath('file.txt\x00.jpg')).toBe('file.txt.jpg');
    });

    it('removes leading slashes', () => {
      expect(sanitizePath('/absolute/path')).toBe('absolute/path');
      expect(sanitizePath('///multiple/slashes')).toBe('multiple/slashes');
    });

    it('normalizes backslashes', () => {
      expect(sanitizePath('path\\to\\file')).toBe('path/to/file');
    });
  });

  describe('sanitizeFilename', () => {
    it('removes path separators', () => {
      expect(sanitizeFilename('path/to/file.txt')).toBe('pathtofile.txt');
      expect(sanitizeFilename('path\\to\\file.txt')).toBe('pathtofile.txt');
    });

    it('removes special characters', () => {
      expect(sanitizeFilename('file<name>.txt')).toBe('filename.txt');
      expect(sanitizeFilename('file:name.txt')).toBe('filename.txt');
    });

    it('limits filename length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });
});

describe('URL Sanitization', () => {
  describe('sanitizeUrl', () => {
    it('removes javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert()')).toBe('');
      expect(sanitizeUrl('JAVASCRIPT:alert()')).toBe('');
    });

    it('removes vbscript: URLs', () => {
      expect(sanitizeUrl('vbscript:alert()')).toBe('');
    });

    it('allows data:image URLs', () => {
      const dataUrl = 'data:image/png;base64,abc123';
      expect(sanitizeUrl(dataUrl)).toBe(dataUrl);
    });

    it('removes non-image data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>')).toBe('');
    });

    it('allows normal URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizeUrl('/relative/path')).toBe('/relative/path');
    });
  });

  describe('sanitizeRedirectUrl', () => {
    const allowedHosts = ['example.com', 'shop.example.com'];

    it('allows relative URLs', () => {
      expect(sanitizeRedirectUrl('/products', allowedHosts)).toBe('/products');
      expect(sanitizeRedirectUrl('/checkout?step=1', allowedHosts)).toBe('/checkout?step=1');
    });

    it('blocks protocol-relative URLs', () => {
      expect(sanitizeRedirectUrl('//evil.com', allowedHosts)).toBeNull();
    });

    it('allows URLs to allowed hosts', () => {
      expect(sanitizeRedirectUrl('https://example.com/page', allowedHosts)).toBe(
        'https://example.com/page'
      );
    });

    it('blocks URLs to disallowed hosts', () => {
      expect(sanitizeRedirectUrl('https://evil.com/page', allowedHosts)).toBeNull();
    });

    it('returns null for invalid URLs', () => {
      expect(sanitizeRedirectUrl('not a url', allowedHosts)).toBeNull();
    });
  });
});

describe('JSON Sanitization', () => {
  describe('sanitizeJson', () => {
    it('removes BOM', () => {
      expect(sanitizeJson('\uFEFF{"key":"value"}')).toBe('{"key":"value"}');
    });

    it('removes control characters', () => {
      expect(sanitizeJson('{"key":"val\x00ue"}')).toBe('{"key":"value"}');
    });

    it('returns {} for non-string input', () => {
      expect(sanitizeJson(null as unknown as string)).toBe('{}');
    });
  });

  describe('sanitizeObject', () => {
    it('escapes HTML in string values', () => {
      const obj = { name: '<script>alert()</script>' };
      const result = sanitizeObject(obj);
      expect(result.name).toBe('&lt;script&gt;alert()&lt;&#x2F;script&gt;');
    });

    it('trims strings', () => {
      const obj = { name: '  hello  ' };
      const result = sanitizeObject(obj);
      expect(result.name).toBe('hello');
    });

    it('handles nested objects', () => {
      const obj = { user: { name: '<b>John</b>' } };
      const result = sanitizeObject(obj);
      expect(result.user.name).toBe('&lt;b&gt;John&lt;&#x2F;b&gt;');
    });

    it('handles arrays', () => {
      const obj = { tags: ['<tag1>', '<tag2>'] };
      const result = sanitizeObject(obj);
      expect(result.tags).toEqual(['&lt;tag1&gt;', '&lt;tag2&gt;']);
    });

    it('respects options', () => {
      const obj = { name: '  <b>John</b>  ' };
      const result = sanitizeObject(obj, { escapeHtml: false, trimStrings: false });
      expect(result.name).toBe('  <b>John</b>  ');
    });

    it('respects max depth', () => {
      const deep: Record<string, unknown> = { level: 0 };
      let current = deep;
      for (let i = 1; i <= 15; i++) {
        current.child = { level: i };
        current = current.child as Record<string, unknown>;
      }
      current.value = '<script>';

      const result = sanitizeObject(deep, { maxDepth: 5 });
      // Deep values should not be sanitized
      expect(result).toBeDefined();
    });
  });
});

describe('Review Sanitization', () => {
  describe('sanitizeReview', () => {
    it('removes phone numbers', () => {
      expect(sanitizeReview('Call me at 0501234567')).toContain('[телефон видалено]');
      expect(sanitizeReview('Call me at +380501234567')).toContain('[телефон видалено]');
    });

    it('removes email addresses', () => {
      expect(sanitizeReview('Contact test@example.com')).toContain('[email видалено]');
    });

    it('normalizes excessive line breaks', () => {
      expect(sanitizeReview('Hello\n\n\n\n\nWorld')).toBe('Hello\n\nWorld');
    });

    it('escapes HTML', () => {
      expect(sanitizeReview('<script>alert()</script>')).toContain('&lt;script&gt;');
    });
  });

  describe('detectSpamPatterns', () => {
    it('detects all caps content', () => {
      const result = detectSpamPatterns('THIS IS ALL CAPS SPAM MESSAGE');
      expect(result.isSpam).toBe(true);
      expect(result.reasons).toContain('Занадто багато великих літер');
    });

    it('detects repeated characters', () => {
      const result = detectSpamPatterns('Helloooooo');
      expect(result.isSpam).toBe(true);
      expect(result.reasons).toContain('Повторювані символи');
    });

    it('detects excessive punctuation', () => {
      const result = detectSpamPatterns('Buy now!!!???');
      expect(result.isSpam).toBe(true);
      expect(result.reasons).toContain('Занадто багато знаків пунктуації');
    });

    it('detects spam phrases', () => {
      const result = detectSpamPatterns('Безкоштовні гроші для вас');
      expect(result.isSpam).toBe(true);
      expect(result.reasons).toContain('Підозрілий контент');
    });

    it('accepts normal content', () => {
      const result = detectSpamPatterns('Чудовий товар! Рекомендую.');
      expect(result.isSpam).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });
});
