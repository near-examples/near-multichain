const LoadingSpinner = () => (
  <div className="d-flex justify-content-center align-items-center py-3">
    <div
      className="spinner-border spinner-border-sm text-primary me-2"
      role="status"
    >
      <span className="visually-hidden">Loading...</span>
    </div>
    <small className="text-muted">Processing...</small>
  </div>
);

export default LoadingSpinner;
