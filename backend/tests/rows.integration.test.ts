import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import rowsRouter from '../routes/rows.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { pool } from '../db.js';

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

type MockFn = ReturnType<typeof vi.fn>;
type MockedClient = {
  query: MockFn;
  release: MockFn;
};

type MockedPool = {
  query: MockFn;
  connect: MockFn;
};

const mockedPool = pool as unknown as MockedPool;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rows', rowsRouter);
  app.use(errorHandler);
  return app;
}

describe('rows router integration', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('POST /api/rows/with-default-columns は行と3カラムをトランザクションで作成する', async () => {
    const client: MockedClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockedPool.connect.mockResolvedValue(client);

    let insertedColumnCount = 0;
    client.query.mockImplementation(async (sql: unknown, params?: unknown[]) => {
      const statement = String(sql);
      if (statement === 'BEGIN' || statement === 'COMMIT') {
        return { rows: [] };
      }
      if (statement.includes('INSERT INTO rows')) {
        return {
          rows: [{ id: 50, title: '新しい行', position: 3000 }],
        };
      }
      if (statement.includes('INSERT INTO columns')) {
        insertedColumnCount += 1;
        return {
          rows: [{
            id: 100 + insertedColumnCount,
            title: params?.[0],
            position: params?.[1],
            row_id: params?.[2],
          }],
        };
      }
      throw new Error(`Unexpected SQL: ${statement}`);
    });

    const res = await request(createApp())
      .post('/api/rows/with-default-columns')
      .send({ title: '新しい行', position: 3000 });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(50);
    expect(res.body.title).toBe('新しい行');
    expect(res.body.columns).toHaveLength(3);
    expect(res.body.columns.map((c: { title: string }) => c.title)).toEqual(['未着手', '進行中', '完了']);
    expect(res.body.columns.every((c: { tasks: unknown[] }) => Array.isArray(c.tasks) && c.tasks.length === 0)).toBe(true);

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('POST /api/rows/with-default-columns は途中失敗時にロールバックして 500 を返す', async () => {
    const client: MockedClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockedPool.connect.mockResolvedValue(client);

    let columnInsertCount = 0;
    client.query.mockImplementation(async (sql: unknown, params?: unknown[]) => {
      const statement = String(sql);
      if (statement === 'BEGIN') return { rows: [] };
      if (statement.includes('INSERT INTO rows')) {
        return { rows: [{ id: 99, title: '失敗行', position: 4000 }] };
      }
      if (statement.includes('INSERT INTO columns')) {
        columnInsertCount += 1;
        if (columnInsertCount === 2) {
          throw new Error('column insert failed');
        }
        return {
          rows: [{
            id: 200,
            title: params?.[0],
            position: params?.[1],
            row_id: params?.[2],
          }],
        };
      }
      if (statement === 'ROLLBACK') return { rows: [] };
      throw new Error(`Unexpected SQL: ${statement}`);
    });

    const res = await request(createApp())
      .post('/api/rows/with-default-columns')
      .send({ title: '失敗行', position: 4000 });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'column insert failed' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
