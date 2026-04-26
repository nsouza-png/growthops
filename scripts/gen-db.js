const fs = require('fs');
const p = 'c:/Users/n.souza_g4educacao/Documents/G4OS GROWTH OPS FULL/Projects/growthops-main/app/src/types/database.ts';
let c = 'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]\n\n';
c += 'export type AppSchema = {\n';
c += '    Tables: {\n';

function table(name, row) {
  c += '      ' + name + ': {\n';
  c += '        Row: { ' + row + ' }\n';
  c += '        Insert: { ' + row.replace(/: /g, '?: ') + ' }\n';
  c += '        Update: { ' + row.replace(/: /g, '?: ') + ' }\n';
  c += '        Relationships: []\n';
  c += '      },\n';
}

table('api_keys', 'created_at: string; expires_at: string | null; id: string; is_active: boolean; key_hash: string; last_used_at: string | null; name: string; permissions: string[]');

const callAnalysisRow = 'analysis_version: number | null; behavior_analysis: Json | null; business_outcome: Json | null; buy_intent_signals: Json | null; call_id: string; churn_signals: Json | null; client_pains: Json | null; competitors: Json | null; created_at: string; critical_moments: Json | null; followup_draft: string | null; id: string; longest_monologue_s: number | null; model_version: string | null; next_steps: Json | null; objections: Json | null; questions_count: number | null; smart_trackers_detected: string[] | null; speaker_segments: Json | null; summary_text: string | null; talk_ratio_client: number | null; talk_ratio_seller: number | null';
table('call_analysis', callAnalysisRow);

table('call_feedback', 'author_email: string | null; call_id: string; created_at: string; id: string; text: string; type: string');

table('calls', 'call_date: string | null; closer_email: string | null; created_at: string; data_source: string | null; deal_acv: number | null; deal_id: string | null; deal_stage: string | null; deal_status: string | null; duration_seconds: number | null; id: string; lead_faixa: string | null; lead_perfil: string | null; lead_segmento: string | null; origem_da_receita: string | null; processed_at: string | null; processing_stage: string | null; processing_status: string; produto_oferecido: string | null; prospect_company: string | null; prospect_name: string | null; segment: string | null; seller_email: string; seller_name: string | null; squad: string | null; status: string; tldv_call_id: string | null; tldv_url: string | null; transcript_fetched: boolean; transcript_quality: string | null; transcript_text: string | null; updated_at: string; utm_campaign: string | null');

table('framework_scores', 'call_id: string; challenger_take_control: number | null; challenger_tailor: number | null; challenger_teach: number | null; challenger_total: number | null; created_at: string; id: string; spiced_critical_event: number | null; spiced_decision: number | null; spiced_impact: number | null; spiced_pain: number | null; spiced_situation: number | null; spiced_total: number | null; spin_implication: number | null; spin_need_payoff: number | null; spin_problem: number | null; spin_situation: number | null; spin_total: number | null');

table('profiles', 'avatar_url: string | null; created_at: string; email: string | null; full_name: string | null; id: string; role: string | null; updated_at: string | null');

table('smart_trackers', 'category: string; created_at: string; description: string | null; id: string; is_active: boolean; name: string');

table('snippets', 'call_id: string; created_at: string; created_by: string | null; id: string; is_featured: boolean | null; tag: string | null; text: string; timestamp_s: number | null');

table('user_roles', 'created_at: string; email: string | null; id: string; is_active: boolean | null; onboarding_completed: boolean | null; preferred_name: string | null; role: string; squad: string | null; updated_at: string | null; user_id: string');

c += '    }\n';
c += '    Views: {\n';
c += '      unified_calls: {\n';
c += '        Row: { id: string | null; vendedor: string | null; lead: string | null; data: string | null; score_geral: number | null; resumo: string | null; deal_id: string | null; closer_email: string | null; sort_date: string | null; data_source: string | null; processing_status: string | null; processing_stage: string | null; spiced_total: number | null; spiced_situation: number | null; spiced_pain: number | null; spiced_impact: number | null; spiced_critical_event: number | null; spiced_decision: number | null; spin_situation: number | null; spin_problem: number | null; spin_implication: number | null; spin_need_payoff: number | null; spin_total: number | null; challenger_teach: number | null; challenger_tailor: number | null; challenger_take_control: number | null; challenger_total: number | null; client_pains: Json | null; proximos_passos: Json | null; critical_moments: Json | null; talk_ratio_seller: number | null; talk_ratio_client: number | null; longest_monologue_s: number | null; questions_count: number | null; competitors: Json | null; objections: Json | null; churn_signals: Json | null; buy_intent_signals: Json | null; smart_trackers_detected: string[] | null; behavior_analysis: Json | null; business_outcome: Json | null; followup_draft: string | null; model_version: string | null; analysis_version: number | null }\n';
c += '        Relationships: []\n';
c += '      },\n';
c += '      urgent_calls: {\n';
c += '        Row: { call_id: string | null; lead: string | null; closer_email: string | null; squad: string | null; deal_acv: number | null; deal_stage: string | null; deal_status: string | null; happened_at: string | null; buy_intent_signals: Json | null; spiced_total: number | null; spiced_pain: number | null; spiced_critical_event: number | null; priority_level: string | null; priority_score: number | null }\n';
c += '        Relationships: []\n';
c += '      }\n';
c += '    }\n';
c += '    Functions: {}\n';
c += '    Enums: {}\n';
c += '    CompositeTypes: {}\n';
c += '  }\n';
c += '}\n\n';
c += 'export type Database = {\n';
c += '  __InternalSupabase: { PostgrestVersion: "12.2.3 (519615d)" }\n';
c += '  public: AppSchema\n';
c += '  GrowthPlatform: AppSchema\n';
c += '}\n';
c += '\n';
c += "export type Call = Database['GrowthPlatform']['Tables']['calls']['Row']\n";
c += "export type CallAnalysis = Database['GrowthPlatform']['Tables']['call_analysis']['Row']\n";
c += "export type MethodologyScores = Database['GrowthPlatform']['Tables']['framework_scores']['Row']\n";

fs.writeFileSync(p, c);
console.log('Wrote', p, 'size', c.length);
