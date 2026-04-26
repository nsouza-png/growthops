import { getSupabaseClient } from './supabase.ts'
import OpenAI from "https://esm.sh/openai@4.71.1"

interface CallAIOptions {
  model: string
  system: string
  user: string
  maxTokens?: number
  responseFormat?: 'text' | 'json_object'
  userId: string
  functionName: string
}

const LIMITS: Record<string, number> = {
  'analyze-call': 50,
  'generate-followup': 20,
  'gp-generate-pdi': 10,
  'gp-analyze-live-chunk': 100,
}

export async function checkRateLimit(userId: string, functionName: string): Promise<void> {
  const limit = LIMITS[functionName]
  if (!limit) return // no limit defined

  const supabase = getSupabaseClient()
  
  // Count requests in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  
  const { count, error } = await supabase
    .from('ai_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .gte('created_at', oneHourAgo)
    
  if (error) {
    console.error('Error checking rate limit:', error)
    return // allow if we can't check
  }
  
  if (count !== null && count >= limit) {
    throw new Error(`Rate limit exceeded for ${functionName}. Max ${limit} calls per hour.`)
  }
}

export async function logAIUsage(userId: string, functionName: string, tokensUsed: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('ai_usage_log')
    .insert({
      user_id: userId,
      function_name: functionName,
      tokens_used: tokensUsed
    })
    
  if (error) {
    console.error('Error logging AI usage:', error)
  }
}

export async function callAI(options: CallAIOptions): Promise<{ content: string; usage: any }> {
  await checkRateLimit(options.userId, options.functionName)

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')

  const openai = new OpenAI({ apiKey: openaiKey })

  const msg = await openai.chat.completions.create({
    model: options.model,
    max_tokens: options.maxTokens ?? 2000,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user }
    ],
    response_format: options.responseFormat === 'json_object' ? { type: "json_object" } : undefined
  })

  const content = msg.choices[0]?.message?.content || "{}"
  const usage = msg.usage

  if (usage && usage.total_tokens) {
    logAIUsage(options.userId, options.functionName, usage.total_tokens).catch(console.error)
  }

  return { content, usage }
}
