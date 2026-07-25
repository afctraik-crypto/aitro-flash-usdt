const SUPABASE_URL = 'https://lcjnvqmefazftfggefrq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjam52cW1lZmF6ZnRmZ2dlZnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mzg0ODgsImV4cCI6MjEwMDQxNDQ4OH0.ZN0uhAeqWYgZz3H9NLfJ9iMLBsURZ_Bu2hIjC1nl08o';

exports.handler = async (event, context) => {
  const path = event.path.replace('/.netlify/functions/supabase-proxy', '') || '/';
  const url = `${SUPABASE_URL}/rest/v1${path}${event.rawQuery ? '?' + event.rawQuery : ''}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=representation'
  };
  
  if (event.headers) {
    Object.keys(event.headers).forEach(key => {
      if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
        headers[key] = event.headers[key];
      }
    });
  }
  
  try {
    const response = await fetch(url, {
      method: event.httpMethod,
      headers,
      body: event.body && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD' ? event.body : undefined
    });
    
    const text = await response.text();
    
    return {
      statusCode: response.status,
      body: text,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Access-Control-Allow-Origin': '*' }
    };
  }
};