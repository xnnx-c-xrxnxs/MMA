import { DynamoDBConfig } from './dynamodb.config';

jest.mock('@old-st/dynamodb-onetable', () => ({
  createDynamoLocalClient: jest.fn(() => ({ type: 'local-client' })),
  createAWSClient: jest.fn(() => ({ type: 'aws-client' })),
  createTable: jest.fn((opts) => ({ name: opts.name, type: 'table' })),
}));

import {
  createDynamoLocalClient,
  createAWSClient,
  createTable,
} from '@old-st/dynamodb-onetable';

describe('DynamoDBConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset private statics between tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (DynamoDBConfig as any).client = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (DynamoDBConfig as any).tables = new Map();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getClient', () => {
    it('creates a local client when STAGE=local', () => {
      process.env.STAGE = 'local';
      delete process.env.DYNAMODB_ENDPOINT;

      const client = DynamoDBConfig.getClient();
      expect(createDynamoLocalClient).toHaveBeenCalledTimes(1);
      expect(createAWSClient).not.toHaveBeenCalled();
      expect(client).toEqual({ type: 'local-client' });
    });

    it('creates a local client when DYNAMODB_ENDPOINT is set', () => {
      delete process.env.STAGE;
      process.env.DYNAMODB_ENDPOINT = 'http://localhost:4566';

      DynamoDBConfig.getClient();
      expect(createDynamoLocalClient).toHaveBeenCalledTimes(1);
    });

    it('creates an AWS client when STAGE is not local and no DYNAMODB_ENDPOINT', () => {
      delete process.env.STAGE;
      delete process.env.DYNAMODB_ENDPOINT;

      DynamoDBConfig.getClient();
      expect(createAWSClient).toHaveBeenCalledTimes(1);
      expect(createDynamoLocalClient).not.toHaveBeenCalled();
    });

    it('returns the same client instance on repeated calls (singleton)', () => {
      process.env.STAGE = 'local';

      const c1 = DynamoDBConfig.getClient();
      const c2 = DynamoDBConfig.getClient();
      expect(c1).toBe(c2);
      expect(createDynamoLocalClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTable', () => {
    it('creates a table for a given name and schema', () => {
      process.env.STAGE = 'local';
      const schema = { models: {} };

      const table = DynamoDBConfig.getTable('TestTable', schema);
      expect(createTable).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestTable', schema }),
      );
      expect(table).toBeDefined();
    });

    it('returns the same table instance for the same name (singleton)', () => {
      process.env.STAGE = 'local';
      const schema = { models: {} };

      const t1 = DynamoDBConfig.getTable('TestTable', schema);
      const t2 = DynamoDBConfig.getTable('TestTable', schema);
      expect(t1).toBe(t2);
      expect(createTable).toHaveBeenCalledTimes(1);
    });

    it('creates separate table instances for different names', () => {
      process.env.STAGE = 'local';
      const schema = { models: {} };

      DynamoDBConfig.getTable('TableA', schema);
      DynamoDBConfig.getTable('TableB', schema);
      expect(createTable).toHaveBeenCalledTimes(2);
    });
  });
});
