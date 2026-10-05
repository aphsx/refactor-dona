"use client";

import { useEffect, useState } from "react";

export function useServerPage<T>(
  resetKey: string,
  load: (page: number, pageSize: number) => Promise<{ items?: T[] | null; total: number }>,
  initial?: { items?: T[] | null; total: number } | null,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<T[]>(() => initial?.items ?? []);
  const [total, setTotal] = useState(() => initial?.total ?? 0);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    let alive = true;
    void load(page, pageSize)
      .then((result) => {
        if (!alive) return;
        setRows(result.items ?? []);
        setTotal(result.total ?? 0);
      })
      .catch(() => {
        if (!alive) return;
        setRows([]);
        setTotal(0);
      });
    return () => {
      alive = false;
    };
    // load is recreated by callers; resetKey carries the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, resetKey]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const current = Math.min(page, pageCount);
  return {
    page: current,
    pageSize,
    pageCount,
    total,
    rows,
    setPage,
    setPageSize(size: number) {
      setPageSize(size);
      setPage(1);
    },
  };
}
