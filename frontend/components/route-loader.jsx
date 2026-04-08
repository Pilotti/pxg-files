import "../styles/route-loader.css"

export default function RouteLoader({ title = "Carregando", text = "Aguarde um instante..." }) {
  return (
    <div className="route-loader">
      <div className="route-loader__card">
        <div className="route-loader__spinner" aria-hidden="true" />
        <h1 className="route-loader__title">{title}</h1>
        <p className="route-loader__text">{text}</p>
      </div>
    </div>
  )
}
