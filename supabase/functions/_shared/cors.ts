export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin');
  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN');
  
  // If allowedOrigin is set and matches the request origin, use it.
  // Otherwise, if allowedOrigin is '*', use it.
  // Otherwise, default to the specific allowed origin to harden.
  const headerOrigin = (allowedOrigin === '*' || !allowedOrigin) 
    ? (origin || '*') 
    : allowedOrigin;

  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': headerOrigin,
  };
}
