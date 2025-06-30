import PropTypes from "prop-types";
import LoadingSpinner from "./LoadingSpinner";

const StatusMessage = ({ status, isLoading }) => {
  console.log(status);
  
  return (
    <div className={`mt-3 small text-center text-warning`}>
      {isLoading && <LoadingSpinner />}
      <div className="mt-2">{status}</div>
    </div>
  );
};

StatusMessage.propTypes = {
  status: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.node
  ]).isRequired,
  isLoading: PropTypes.bool.isRequired,
};

export default StatusMessage;
