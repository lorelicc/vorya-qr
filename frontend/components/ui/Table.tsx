import type { ComponentType, ReactNode } from "react";
import styles from "./Table.module.css";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "start" | "end";
  /** Hidden label on mobile, where each row becomes a card. */
  mobileLabel?: boolean;
};

type Props<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: ReactNode;
  /** Replaces the plain <tr> (e.g. to make rows draggable). Must render a <tr>. */
  rowComponent?: ComponentType<{ row: T; children: ReactNode }>;
};

export function Table<T>({ caption, columns, rows, rowKey, empty, rowComponent }: Props<T>) {
  const Row = rowComponent;
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-align={column.align ?? "start"}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cells = columns.map((column) => (
              <td
                key={column.key}
                data-align={column.align ?? "start"}
                data-label={column.mobileLabel === false ? undefined : column.header}
              >
                {column.render(row)}
              </td>
            ));
            return Row ? (
              <Row key={rowKey(row)} row={row}>
                {cells}
              </Row>
            ) : (
              <tr key={rowKey(row)}>{cells}</tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
