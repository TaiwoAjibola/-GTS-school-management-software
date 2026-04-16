export const notFound = (req, res) => {
  res.status(404).json({ message: 'Route not found' })
}

export const errorHandler = (error, req, res, next) => {
  const status = error.status || 500
  const message = error.message || 'Internal server error'
  // Always log server errors so Render log captures the real cause
  if (status >= 500) {
    console.error('[500 Error]', error)
  }
  res.status(status).json({ message })
}
