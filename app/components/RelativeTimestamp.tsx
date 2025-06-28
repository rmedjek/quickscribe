// app/components/RelativeTimestamp.tsx
"use client";

import {useState, useEffect} from "react";
import {formatDistanceToNow} from "date-fns";

interface Props {
  date: Date | null;
}

export default function RelativeTimestamp({date}: Props) {
  const [relativeTime, setRelativeTime] = useState("");

  useEffect(() => {
    if (date) {
      setRelativeTime(formatDistanceToNow(new Date(date), {addSuffix: true}));
    }
  }, [date]);

  // Render nothing on the server, and only render the relative time on the client
  // after the component has mounted. This prevents the mismatch.
  if (!date || !relativeTime) {
    return null;
  }

  return <span>{relativeTime}</span>;
}
