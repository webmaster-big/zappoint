import React from "react";
import { useParams } from "react-router-dom";
import BookingWidget from "./BookingWidget";

const EmbedBookingRoute = () => {
  const { packageId } = useParams<{ packageId: string }>();
  if (!packageId) return <div>Missing packageId</div>;
  return (
    <div className="container mx-auto p-4">
      <BookingWidget packageId={packageId} />
    </div>
  );
};

export default EmbedBookingRoute;