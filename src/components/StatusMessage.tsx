import React from "react";
import LoadingSpinner from "./LoadingSpinner";

interface StatusMessageProps {
  status: string | JSX.Element;
  isLoading: boolean;
}

const StatusMessage = ({ status, isLoading }: StatusMessageProps) => {
  console.log(status);

  return (
    <div className="mt-3 small text-center text-warning">
      {isLoading && <LoadingSpinner />}
      <div className="mt-2">{status}</div>
    </div>
  );
};

export default StatusMessage;
