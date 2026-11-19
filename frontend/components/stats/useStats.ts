"use client";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { rangeQuery, type RangeValue } from "./RangePicker";

/** Loads statistics for a range; keeps the previous data visible while the next one loads. */
export function useStats<T>(path: string) {
  const [range, setRange] = useState<RangeValue>({ range: "30d" });
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const query = rangeQuery(range);
  useEffect(() => {
    let alive = true;
    api<T>(`${path}?${query}`)
      .then((result) => alive && (setData(result), setError("")))
      .catch((err) => alive && setError(errorMessage(err)));
    return () => {
      alive = false;
    };
  }, [path, query]);
  return { range, setRange, data, error, csvHref: `/api/${path}.csv?${query}` };
}
