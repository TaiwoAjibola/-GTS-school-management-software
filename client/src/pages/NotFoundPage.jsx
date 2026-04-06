import { Link } from 'react-router-dom'

const NotFoundPage = () => (
  <div className="min-h-screen grid place-items-center p-4">
    <div className="text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <Link to="/" className="text-slate-700 underline mt-2 inline-block">Go home</Link>
    </div>
  </div>
)

export default NotFoundPage
