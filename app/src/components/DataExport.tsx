import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, Calendar, User, Check, AlertCircle, Loader2 } from 'lucide-react'
import { useDataExport, type ExportFormat, type ExportType } from '../hooks/useDataExport'
import { cn } from '../lib/cn'

interface DataExportProps {
  className?: string
  onExportComplete?: () => void
}

const EXPORT_TYPES: { value: ExportType; label: string; description: string }[] = [
  { value: 'insights', label: 'Insights', description: 'Todos os insights com scores e metodologias' },
  { value: 'calls', label: 'Calls', description: 'Dados brutos das chamadas' },
  { value: 'team-report', label: 'Relatório de Equipe', description: 'Análise consolidada por vendedor' },
  { value: 'leaderboard', label: 'Leaderboard', description: 'Ranking de performance' },
]

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet, description: 'Planilha, fácil análise' },
  { value: 'pdf', label: 'PDF', icon: FileText, description: 'Relatório formatado' },
] as const

export default function DataExport({ className, onExportComplete }: DataExportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ExportType>('insights')
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv')
  const [daysAgo, setDaysAgo] = useState<number>(30)
  const [vendedor, setVendedor] = useState('')
  
  const { exportData, isExporting, error } = useDataExport()

  const handleExport = async () => {
    await exportData({
      type: selectedType,
      format: selectedFormat,
      daysAgo: daysAgo || undefined,
      vendedor: vendedor.trim() || undefined,
      includeMetadata: true
    })
    
    if (!error) {
      onExportComplete?.()
      setIsOpen(false)
    }
  }

  return (
    <div className={cn("relative", className)}>
      {/* Export Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-bg-card border border-border rounded-lg hover:bg-bg-elevated transition-colors"
      >
        <Download size={16} />
        Exportar
      </button>

      {/* Export Modal */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-bg-card border border-border rounded-xl shadow-2xl z-50">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Download size={16} />
              Exportar Dados
            </h3>

            {/* Export Type Selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-secondary mb-2">Tipo de Exportação</label>
              <div className="space-y-2">
                {EXPORT_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      selectedType === type.value
                        ? "border-signal-blue bg-signal-blue/5"
                        : "border-border hover:bg-bg-elevated"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">{type.label}</span>
                      {selectedType === type.value && (
                        <Check size={16} className="text-signal-blue" />
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary mt-1">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-secondary mb-2">Formato</label>
              <div className="grid grid-cols-2 gap-2">
                {FORMAT_OPTIONS.map(format => (
                  <button
                    key={format.value}
                    onClick={() => setSelectedFormat(format.value)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border transition-colors",
                      selectedFormat === format.value
                        ? "border-signal-blue bg-signal-blue/5"
                        : "border-border hover:bg-bg-elevated"
                    )}
                  >
                    <format.icon size={16} className={cn(
                      selectedFormat === format.value ? "text-signal-blue" : "text-text-tertiary"
                    )} />
                    <div className="text-left">
                      <div className="text-sm font-medium text-text-primary">{format.label}</div>
                      <div className="text-xs text-text-tertiary">{format.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  <Calendar size={12} className="inline mr-1" />
                  Período (dias)
                </label>
                <select
                  value={daysAgo}
                  onChange={(e) => setDaysAgo(parseInt(e.target.value))}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                >
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                  <option value={365}>Último ano</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  <User size={12} className="inline mr-1" />
                  Vendedor (opcional)
                </label>
                <input
                  type="text"
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  placeholder="Filtrar por vendedor"
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/20 rounded-lg flex items-start gap-2">
                <AlertCircle size={14} className="text-signal-red mt-0.5" />
                <p className="text-xs text-signal-red">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-bg-elevated transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1 px-3 py-2 bg-signal-blue text-white rounded-lg text-sm font-medium hover:bg-signal-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Exportar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
