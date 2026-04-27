import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="p-8 max-w-md mx-auto flex flex-col items-center text-center gap-4">
      <p className="text-xs font-bold uppercase tracking-widest text-text-tertiary">404</p>
      <h1 className="text-xl font-bold text-text-primary">Página não encontrada</h1>
      <p className="text-sm text-text-secondary leading-relaxed">
        O endereço não corresponde a nenhuma rota do Growth Ops.
      </p>
      <Link to="/performance" className="btn-primary text-sm px-4 py-2">
        Ir para Performance
      </Link>
    </div>
  )
}
