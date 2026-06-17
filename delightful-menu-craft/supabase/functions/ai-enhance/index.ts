// Supabase Edge Function: ai-enhance
// A thin, authenticated proxy to the Anthropic API so the API key never ships
// to the browser. JWT verification is ON by default — only logged-in users
// (a valid Supabase session) can invoke this; supabase-js attaches the token.
//
// Deploy:   supabase functions deploy ai-enhance
// Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { prompt, model, max_tokens } = await req.json();
    if (!prompt || typeof prompt !== 'string') return json({ error: 'Missing prompt' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }, 500);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: typeof model === 'string' ? model : 'claude-haiku-4-5',
        max_tokens: typeof max_tokens === 'number' ? max_tokens : 16000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: `Anthropic error ${resp.status}: ${detail}` }, 502);
    }

    const data = await resp.json();
    const text =
      (data.content ?? []).find((c: { type: string }) => c.type === 'text')?.text ?? '';
    return json({ text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
