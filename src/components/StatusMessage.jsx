import PropTypes from "prop-types";
import LoadingSpinner from "./LoadingSpinner";

const StatusMessage = ({ status, isLoading }) => {
  const getStatusClass = () => {
    if (isLoading) return "text-info";
    if (status && (status.includes("Error") || status.includes("Failed")))
      return "text-danger";
    if (status && (status.includes("Success") || status.includes("Complete")))
      return "text-success";
    return "text-warning";
  };

  return (
    <div className={`mt-3 small text-center ${getStatusClass()}`}>
      {isLoading && <LoadingSpinner />}
      <div className="mt-2">{status}</div>
    </div>
  );
};

StatusMessage.propTypes = {
  status: PropTypes.string.isRequired,
  isLoading: PropTypes.bool.isRequired,
};

export default StatusMessage;
