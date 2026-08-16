/**
 * In-memory mock database.
 *
 * Drop-in replacement for the drizzle NodePostgres database when no
 * `DATABASE_URL` is configured. Implements just the query surface the
 * API routes use (select/where/orderBy/limit/leftJoin, insert, update,
 * delete, execute) against the same schema tables, seeded with the
 * demo scenario from `src/lib/db-seed.ts`.
 *
 * This is how the front end is scaffolded and polished without any
 * infrastructure: mock smart contracts, mock accounts (personas), and
 * now a mock database. Swap in a real Postgres by setting DATABASE_URL.
 */
import { Column } from "drizzle-orm/column";
import { Param, SQL, StringChunk } from "drizzle-orm/sql";

const NAME_KEY = Symbol.for("drizzle:Name");
const COLUMNS_KEY = Symbol.for("drizzle:Columns");

type Row = Record<string, unknown>;

interface MockTable {
  name: string;
  /** Drizzle table instance (for column->table identity checks). */
  drizzleTable: unknown;
  /** JS column key (e.g. `treasuryId`) -> Column. */
  columns: Record<string, Column>;
  rows: Row[];
}

interface QueryOptions {
  shape?: Record<string, unknown>;
  leftTable?: unknown;
  where?: unknown;
  joins?: Array<{ right: unknown; on: unknown }>;
  orderBy?: unknown[];
  limit?: number;
}

/** Shared across module reloads so HMR doesn't wipe the demo mid-session. */
const GLOBAL_KEY = Symbol.for("cohold.mockDb.tables");
const store: Map<string, MockTable> =
  ((globalThis as Record<symbol, unknown>)[GLOBAL_KEY] as
    | Map<string, MockTable>
    | undefined) ?? new Map<string, MockTable>();
(globalThis as Record<symbol, unknown>)[GLOBAL_KEY] = store;

function isSQL(value: unknown): value is SQL {
  return value instanceof SQL;
}

/**
 * Rows are stored under JS column keys (`treasuryId`), while columns
 * carry the DB snake_case name (`treasury_id`). Resolve the JS key by
 * locating the column instance in the table's column map.
 */
function jsKey(col: Column, columns: Record<string, Column>): string | undefined {
  for (const [key, c] of Object.entries(columns)) {
    if (c === col) return key;
  }
  return col.name;
}

function rowValue(
  col: Column,
  row: Row,
  columns: Record<string, Column>
): unknown {
  return row[jsKey(col, columns) ?? col.name];
}

/**
 * Evaluate a drizzle condition (eq / and / or conjunctions) against a row.
 * Chunk grammar: Column | Param | nested SQL | StringChunk operator.
 * The conditions used here are conjunctions of equalities, which this
 * reduction handles exactly.
 */
function evalCondition(
  cond: unknown,
  row: Row,
  columns: Record<string, Column>
): boolean {
  if (cond === undefined || cond === null) return true;
  if (!isSQL(cond)) return true;

  const vals: unknown[] = [];
  const ops: string[] = [];
  for (const chunk of cond.queryChunks) {
    if (chunk instanceof Column) {
      vals.push(rowValue(chunk, row, columns));
    } else if (chunk instanceof Param) {
      vals.push(chunk.value);
    } else if (chunk instanceof SQL) {
      vals.push(evalCondition(chunk, row, columns));
    } else if (chunk instanceof StringChunk) {
      ops.push(String(chunk.value).trim());
    }
  }
  if (vals.length === 0) return true;

  let result = vals[0];
  for (let i = 1; i < vals.length; i++) {
    const op = (ops[i - 1] ?? "=").toLowerCase();
    if (op === "and") result = Boolean(result) && Boolean(vals[i]);
    else if (op === "or") result = Boolean(result) || Boolean(vals[i]);
    else result = result === vals[i] || result == vals[i]; // equality
  }
  return Boolean(result);
}

/** Evaluate a join `on` condition against a (left, right) row pair. */
function evalJoinCondition(
  on: unknown,
  leftMt: MockTable,
  rightMt: MockTable,
  leftRow: Row,
  rightRow: Row
): boolean {
  if (!isSQL(on)) return true;
  const leftCol = on.queryChunks.find(
    (c): c is Column => c instanceof Column && c.table === leftMt.drizzleTable
  );
  const rightCol = on.queryChunks.find(
    (c): c is Column => c instanceof Column && c.table === rightMt.drizzleTable
  );
  if (!leftCol || !rightCol) return true; // unknown shape: keep row
  return (
    rowValue(leftCol, leftRow, leftMt.columns) ===
    rowValue(rightCol, rightRow, rightMt.columns)
  );
}

/** Extract the ordering column from a `desc(col)` / `asc(col)` SQL. */
function orderColumn(sql: unknown): Column | undefined {
  if (!isSQL(sql)) return undefined;
  return sql.queryChunks.find((c): c is Column => c instanceof Column);
}

function isTable(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[NAME_KEY] !== undefined
  );
}

class SelectQuery {
  private options: QueryOptions;
  private db: MockDb;

  constructor(db: MockDb, options: QueryOptions) {
    this.db = db;
    this.options = options;
  }

  from(table: unknown): SelectQuery {
    this.options.leftTable = table;
    return this;
  }

  where(cond: unknown): SelectQuery {
    this.options.where = cond;
    return this;
  }

  leftJoin(right: unknown, on: unknown): SelectQuery {
    this.options.joins = [...(this.options.joins ?? []), { right, on }];
    return this;
  }

  orderBy(...cols: unknown[]): SelectQuery {
    this.options.orderBy = cols;
    return this;
  }

  limit(n: number): SelectQuery {
    this.options.limit = n;
    return this;
  }

  private resolve(): Row[] {
    const { leftTable, shape, where, joins, orderBy, limit } = this.options;
    const left = this.db.table(leftTable);
    let rows = left.rows;

    if (joins && joins.length > 0) {
      const out: Row[] = [];
      for (const row of rows) {
        const join = joins[0];
        const right = this.db.table(join.right);
        const matches = right.rows.filter((r) =>
          evalJoinCondition(join.on, left, right, row, r)
        );
        if (matches.length > 0) {
          for (const m of matches) out.push({ ...row, __right: m });
        } else {
          out.push({ ...row, __right: null }); // left join keeps unmatched left rows
        }
      }
      rows = out;
    }

    if (where) rows = rows.filter((r) => evalCondition(where, r, left.columns));

    if (orderBy && orderBy.length > 0) {
      const col = orderColumn(orderBy[0]);
      if (col) {
        rows = [...rows].sort((a, b) => {
          const av = rowValue(col, a, left.columns);
          const bv = rowValue(col, b, left.columns);
          if (av instanceof Date && bv instanceof Date) {
            return bv.getTime() - av.getTime(); // desc (all call sites use desc())
          }
          if (av === bv) return 0;
          const avStr = av as string;
          const bvStr = bv as string;
          return avStr > bvStr ? -1 : 1;
        });
      }
    }

    if (limit !== undefined) rows = rows.slice(0, limit);

    if (shape) {
      return rows.map((row) => {
        const out: Row = {};
        for (const [key, value] of Object.entries(shape)) {
          if (isTable(value)) {
            out[key] = cloneRow(row); // whole-table projection
          } else if (
            value &&
            typeof value === "object" &&
            Object.values(value).every((v) => v instanceof Column)
          ) {
            const picked: Row = {};
            for (const [alias, col] of Object.entries(value as Record<string, Column>)) {
              picked[alias] = row[jsKey(col, left.columns) ?? ""];
            }
            out[key] = picked;
          } else if (value instanceof Column) {
            out[key] = row[value.name];
          }
        }
        return out;
      });
    }

    return rows.map(cloneRow);
  }

  then<TResult1 = Row[], TResult2 = never>(
    onFulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.resolve()).then(onFulfilled, onRejected);
    } catch (err) {
      return Promise.reject(err).then(onFulfilled, onRejected);
    }
  }
}

function cloneRow(row: Row): Row {
  const out: Row = { ...row };
  delete out.__right;
  return out;
}

class MockDb {
  select(shape?: Record<string, unknown>): SelectQuery {
    return new SelectQuery(this, { shape });
  }

  insert(table: unknown) {
    const mt = this.table(table);
    return {
      values: (values: Row | Row[]) => {
        const rows = Array.isArray(values) ? values : [values];
        for (const v of rows) mt.rows.push(this.applyDefaults(mt, v));
        return { rowCount: rows.length, rows };
      },
    };
  }

  update(table: unknown) {
    const mt = this.table(table);
    return {
      set: (values: Row) => ({
        where: (cond: unknown) => {
          let count = 0;
          for (const row of mt.rows) {
            if (evalCondition(cond, row, mt.columns)) {
              Object.assign(row, values);
              count++;
            }
          }
          return { rowCount: count, rows: [] };
        },
      }),
    };
  }

  delete(table: unknown) {
    this.table(table).rows = [];
    return { rowCount: 0, rows: [] };
  }

  /** Health checks only. */
  execute() {
    return { rowCount: 1, rows: [] };
  }

  table(t: unknown): MockTable {
    const name = (t as Record<symbol, unknown>)[NAME_KEY] as string;
    let mt = store.get(name);
    if (!mt) {
      mt = {
        name,
        drizzleTable: t,
        columns: (t as Record<symbol, unknown>)[COLUMNS_KEY] as Record<
          string,
          Column
        >,
        rows: [],
      };
      store.set(name, mt);
    }
    return mt;
  }

  private applyDefaults(mt: MockTable, values: Row): Row {
    const row: Row = { ...values };
    for (const [key, col] of Object.entries(mt.columns)) {
      if (row[key] === undefined) {
        if (col.defaultFn) {
          row[key] = col.defaultFn();
        } else if (col.default !== undefined) {
          if (col.default instanceof SQL) {
            // `now()` -> current time for date columns
            row[key] = col.dataType === "date" ? new Date() : undefined;
          } else {
            row[key] = col.default;
          }
        }
      }
    }
    return row;
  }
}

export const mockDb = new MockDb();