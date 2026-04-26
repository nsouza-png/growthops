/**
 * useDataExport - hook para exportação de dados em CSV e PDF
 * Implementa exportação de insights, calls e relatórios de equipe
 */
import { useState, useCallback } from 'react'
import { useRole } from '../contexts/RoleContext'
import type { InsightRow } from '../types/insights'

export type ExportFormat = 'csv' | 'pdf'
export type ExportType = 'insights' | 'calls' | 'team-report' | 'leaderboard'

interface ExportOptions {
  format: ExportFormat
  type: ExportType
  daysAgo?: number
  vendedor?: string
  includeMetadata?: boolean
}

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { viewedRole } = useRole()

  const exportData = useCallback(async (options: ExportOptions, insightsData?: InsightRow[]) => {
    setIsExporting(true)
    setError(null)

    try {
      // Fetch data based on export type
      let data: any[] = []
      
      switch (options.type) {
        case 'insights':
          if (!insightsData) {
            throw new Error('Insights data is required for insights export')
          }
          data = insightsData
          break
          
        case 'calls':
          // Similar implementation for calls
          data = []
          break
          
        case 'team-report':
          // Generate team report data
          data = []
          break
          
        case 'leaderboard':
          // Generate leaderboard data
          data = []
          break
      }

      // Generate export based on format
      if (options.format === 'csv') {
        await exportToCSV(data, options)
      } else if (options.format === 'pdf') {
        await exportToPDF(data, options)
      }
    } catch (err) {
      console.error('Export error:', err)
      setError(err instanceof Error ? err.message : 'Erro na exportação')
    } finally {
      setIsExporting(false)
    }
  }, [viewedRole])

  const exportToCSV = useCallback(async (data: InsightRow[], options: ExportOptions) => {
    // Generate CSV content
    const headers = [
      'ID', 'Vendedor', 'Lead', 'Data', 'Score Geral', 'Temperatura',
      'Resumo', 'Principais Acertos', 'Pontos de Melhoria',
      'Abertura e Alinhamento', 'Situation', 'Pain', 'Impact',
      'Critical Event Emotion', 'Delivery', 'Condução Fechamento',
      'Deal ID', 'Call Name', 'Status Deal'
    ]

    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        row.id,
        `"${row.vendedor || ''}"`,
        `"${row.lead || ''}"`,
        `"${row.data || ''}"`,
        row.score_geral || '',
        `"${row.temperatura_identificada || ''}"`,
        `"${(row.resumo || '').replace(/"/g, '""')}"`,
        `"${(row.principais_acertos || '').replace(/"/g, '""')}"`,
        `"${(row.pontos_de_melhoria || '').replace(/"/g, '""')}"`,
        `"${row.abertura_e_alinhamento || ''}"`,
        `"${row.situation || ''}"`,
        `"${row.pain || ''}"`,
        `"${row.impact || ''}"`,
        `"${row.critical_event_emotion || ''}"`,
        `"${row.delivery || ''}"`,
        `"${row.conducao_fechamento || ''}"`,
        `"${row.deal_id || ''}"`,
        `"${row.call_name || ''}"`,
        `"${row.status_do_deal || ''}"`
      ].join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `growth-ops-${options.type}-${timestamp}.csv`
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  const exportToPDF = useCallback(async (data: InsightRow[], options: ExportOptions) => {
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `growth-ops-${options.type}-${timestamp}.pdf`

    // Sanitize all user-controlled strings before injecting into HTML
    const esc = (str: string): string =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

    const safeType = esc(options.type)

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Growth Ops Report - ${safeType}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .score-high { color: #22c55e; font-weight: bold; }
          .score-medium { color: #f59e0b; font-weight: bold; }
          .score-low { color: #ef4444; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Growth Ops Report - ${safeType}</h1>
        <p>Generated: ${esc(new Date().toLocaleString('pt-BR'))}</p>
        <p>Records: ${data.length}</p>
        
        <table>
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Lead</th>
              <th>Data</th>
              <th>Score</th>
              <th>Temperatura</th>
              <th>Resumo</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                <td>${esc(row.vendedor || '')}</td>
                <td>${esc(row.lead || '')}</td>
                <td>${esc(row.data || '')}</td>
                <td class="${row.score_geral ? row.score_geral >= 8 ? 'score-high' : row.score_geral >= 6 ? 'score-medium' : 'score-low' : ''}">
                  ${row.score_geral || ''}
                </td>
                <td>${esc(row.temperatura_identificada || '')}</td>
                <td>${esc((row.resumo || '').substring(0, 100))}${row.resumo && row.resumo.length > 100 ? '...' : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `
    
    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  return {
    exportData,
    isExporting,
    error
  }
}
