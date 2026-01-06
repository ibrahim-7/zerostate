import { ApiEndpoint } from '../types/api.types';
import crypto from 'crypto';

export function parsePostmanCollection(collection: any): ApiEndpoint[] {
  const result: ApiEndpoint[] = [];

  function walk(items: any[]) {
    for (const item of items) {
      if (item.item) {
        walk(item.item);
      } else {
        result.push({
          id: crypto.randomUUID(),
          name: item.name,
          method: item.request.method,
          url: buildUrl(item.request.url),
          bodyKeys: extractBodyKeys(item.request.body)
        });
      }
    }
  }

  walk(collection.item ?? []);
  return result;
}

function buildUrl(url: any): string {
  if (typeof url === 'string') return url;
  return `${url.protocol}://${url.host.join('.')}/${url.path?.join('/')}`;
}

function extractBodyKeys(body: any): string[] {
  if (!body || body.mode !== 'raw') return [];
  try {
    return Object.keys(JSON.parse(body.raw));
  } catch {
    return [];
  }
}
