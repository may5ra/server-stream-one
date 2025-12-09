import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (req.method === 'POST') {
      // Webhook endpoint for registering new updates
      const { version, changelog, secret } = await req.json()
      
      // Verify webhook secret
      const expectedSecret = Deno.env.get('AGENT_SECRET')
      if (secret !== expectedSecret) {
        console.log('Invalid webhook secret')
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Registering new update: ${version}`)

      // Mark all previous updates as not available
      await supabase
        .from('system_updates')
        .update({ is_available: false })
        .eq('is_available', true)

      // Insert new update
      const { data, error } = await supabase
        .from('system_updates')
        .insert({
          version,
          changelog,
          is_available: true,
          released_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error inserting update:', error)
        throw error
      }

      console.log('Update registered successfully:', data)

      return new Response(
        JSON.stringify({ success: true, update: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'GET') {
      // Check for available updates
      console.log('Checking for available updates...')
      
      const { data, error } = await supabase
        .from('system_updates')
        .select('*')
        .eq('is_available', true)
        .is('applied_at', null)
        .order('released_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error fetching updates:', error)
        throw error
      }

      const hasUpdate = data && data.length > 0
      console.log(`Update available: ${hasUpdate}`)

      return new Response(
        JSON.stringify({ 
          hasUpdate,
          update: hasUpdate ? data[0] : null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'PATCH') {
      // Mark update as applied
      const { updateId } = await req.json()
      
      console.log(`Marking update ${updateId} as applied`)

      const { error } = await supabase
        .from('system_updates')
        .update({ 
          applied_at: new Date().toISOString(),
          is_available: false 
        })
        .eq('id', updateId)

      if (error) {
        console.error('Error marking update:', error)
        throw error
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
