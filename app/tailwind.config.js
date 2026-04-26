/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ─── G4 Brand Palette (Manual de Engenharia de Marca G4 Educação) ───
        // Primárias
        'g4-navy':    '#001F35',          // Navy Blue — rigor, tradicionalismo
        'g4-golden':  '#B9915B',          // Royal Golden — ambição, autoridade
        'g4-silver':  '#F5F4F3',          // Royal Silver — disciplina, precisão
        // Secundárias
        'g4-maub':    '#031B26',          // Mauá Blue — espírito construtor
        'g4-scaling': '#184460',          // Scaling Blue — inovação, escala
        'g4-founders':'#441C1B',          // Founders Red — energia, liderança
        'g4-clay':    '#842E20',          // Ground Clay — Brasil real, bases sólidas
        // Compat (sinal/alerta — não é cor de marca)
        'g4-red':     '#E30613',
        'g4-red-dim': 'rgba(227,6,19,0.15)',
        'g4-golden-dim': 'rgba(185,145,91,0.15)',

        // ─── Backgrounds (via CSS vars — mudam com .dark) ───────────────────
        bg: {
          base:     'var(--bg-base)',
          card:     'var(--bg-card)',
          card2:    'var(--bg-card2)',
          elevated: 'var(--bg-elevated)',
        },

        // ─── Borders (via CSS vars) ───────────────────────────────────────────
        border: {
          DEFAULT: 'var(--border)',
          mid:     'var(--border-mid)',
          light:   'rgba(0,31,53,0.24)',
        },

        // ─── Text (via CSS vars) ──────────────────────────────────────────────
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
        },

        // ─── Sinais funcionais (UI states) ───────────────────────────────────
        signal: {
          blue:  '#0A84FF',
          green: '#30D158',
          amber: '#FFD60A',
          red:   '#FF3B30',
        },
      },

      fontFamily: {
        // Manrope — fonte digital oficial G4 (Textos, UI)
        sans: [
          'Manrope', '-apple-system', 'BlinkMacSystemFont', 'system-ui',
          'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        // PP Museum não é Google Font — fallback editorial para títulos
        display: [
          'Libre Baskerville', 'Georgia', 'serif',
        ],
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },

      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
