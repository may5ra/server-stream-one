import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ip } = await req.json();

    if (!ip) {
      return new Response(
        JSON.stringify({ error: 'IP address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up geolocation for IP: ${ip}`);

    // Use ip-api.com (free, no API key required, 45 requests per minute)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,isp,org,as,query`);
    
    if (!response.ok) {
      throw new Error(`IP API returned ${response.status}`);
    }

    const data = await response.json();
    
    console.log(`Geolocation result for ${ip}:`, data);

    if (data.status === 'fail') {
      return new Response(
        JSON.stringify({ 
          ip,
          country: 'Unknown',
          countryCode: 'XX',
          city: 'Unknown',
          isp: 'Unknown',
          org: 'Unknown',
          error: data.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ip: data.query || ip,
        country: data.country || 'Unknown',
        countryCode: data.countryCode || 'XX',
        city: data.city || 'Unknown',
        isp: data.isp || 'Unknown',
        org: data.org || 'Unknown',
        as: data.as || 'Unknown'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Geolocation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
