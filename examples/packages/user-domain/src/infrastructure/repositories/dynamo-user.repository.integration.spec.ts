import { DynamoUserRepository } from './dynamo-user.repository';
import { User } from '../../domain/entities';
import { createTable, createDynamoLocalClient } from '@old-st/dynamodb-onetable';
import { UserSchema } from '../schemas/UserSchema';
import { Table } from 'dynamodb-onetable';

/**
 * Integration Tests for DynamoUserRepository
 * Testing against real DynamoDB via LocalStack
 *
 * Setup: Requires LocalStack running (port 4566)
 * docker compose up -d
 */
describe('DynamoUserRepository (Integration)', () => {
  let repository: DynamoUserRepository;
  let table: Table;

  beforeAll(async () => {
    // Create DynamoDB Local client for testing
    const client = createDynamoLocalClient();

    // Create table instance
    table = createTable({
      client,
      name: 'UsersTable-test',
      schema: UserSchema,
    });
    
    // Create the table in DynamoDB Local
    try {
      await table.createTable();
      console.log('✅ Test table created successfully');
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ResourceInUseException') {
        console.log('ℹ️  Table already exists, continuing...');
      } else {
        throw error;
      }
    }
    
    repository = new DynamoUserRepository(table);
  });

  afterAll(async () => {
    // Clean up: Delete test table
    try {
      await table.deleteTable('DeleteTableForever');
      console.log('✅ Test table deleted successfully');
    } catch (error) {
      console.log('ℹ️  Error deleting table (may not exist):', error);
    }
  });

  beforeEach(async () => {
    // Clear table before each test
    // In real tests, you'd implement proper cleanup
  });

  describe('save() and findById()', () => {
    it('should save and retrieve a user', async () => {
      // Create user entity
      const user = User.create({
        email: 'integration@example.com',
        firstName: 'Integration',
        lastName: 'Test',
        userRole: 'USER',
      });

      // Save to database
      const savedUser = await repository.save(user);

      // Verify saved user has ID
      expect(savedUser.getUserId()).toBeDefined();
      expect(savedUser.getUserId()).not.toBeNull();

      // Retrieve from database
      const userId = savedUser.getUserId();
      expect(userId).toBeDefined();
      const retrievedUser = await repository.findById(userId as string);

      // Verify data matches
      expect(retrievedUser).not.toBeNull();
      expect(retrievedUser?.getEmail()).toBe('integration@example.com');
      expect(retrievedUser?.getFirstName()).toBe('Integration');
      expect(retrievedUser?.getLastName()).toBe('Test');
      expect(retrievedUser?.getUserRole()).toBe('USER');
      expect(retrievedUser?.getUserStatus()).toBe('PENDING');
    });

    it('should return null for non-existent user', async () => {
      const result = await repository.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail()', () => {
    it('should find user by email using GSI4', async () => {
      // Create and save user
      const user = User.create({
        email: 'gsi-test@example.com',
        firstName: 'GSI',
        lastName: 'Test',
      });
      await repository.save(user);

      // Query by email
      const found = await repository.findByEmail('gsi-test@example.com');

      expect(found).not.toBeNull();
      expect(found?.getEmail()).toBe('gsi-test@example.com');
    });

    it('should return null for non-existent email', async () => {
      const result = await repository.findByEmail('notfound@example.com');
      expect(result).toBeNull();
    });
  });

  describe('listByStatus()', () => {
    it('should list users by status using GSI5', async () => {
      // Create multiple users with same status
      const user1 = User.create({
        email: 'pending1@example.com',
        firstName: 'Pending',
        lastName: 'One',
      });
      const user2 = User.create({
        email: 'pending2@example.com',
        firstName: 'Pending',
        lastName: 'Two',
      });

      await repository.save(user1);
      await repository.save(user2);

      // Query by status
      const result = await repository.listByStatus('PENDING', 10);

      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.data.every(u => u.getUserStatus() === 'PENDING')).toBe(true);
    });

    describe('pagination', () => {
      const testUserIds: string[] = [];

      beforeAll(async () => {
        // Create 5 users for pagination testing
        const users = [
          { email: 'page-test-1@example.com', firstName: 'Page1', lastName: 'User' },
          { email: 'page-test-2@example.com', firstName: 'Page2', lastName: 'User' },
          { email: 'page-test-3@example.com', firstName: 'Page3', lastName: 'User' },
          { email: 'page-test-4@example.com', firstName: 'Page4', lastName: 'User' },
          { email: 'page-test-5@example.com', firstName: 'Page5', lastName: 'User' },
        ];

        for (const userData of users) {
          const user = User.create(userData);
          const saved = await repository.save(user);
          const userId = saved.getUserId();
          if (userId) {
            testUserIds.push(userId);
          }
        }
      });

      afterAll(async () => {
        // Cleanup: soft-delete test users via domain method
        for (const userId of testUserIds) {
          try {
            const user = await repository.findById(userId);
            if (user && !user.isDeleted()) {
              user.markAsDeleted();
              await repository.save(user);
            }
          } catch {
            // Ignore errors during cleanup
          }
        }
      });

      it('should paginate forward to next page with correct data', async () => {
        // First page - limit 2
        const page1 = await repository.listByStatus('PENDING', 2, 'next');

        // Verify first page
        expect(page1.data.length).toBe(2);
        expect(page1.data.every(u => u.getUserStatus() === 'PENDING')).toBe(true);
        expect(page1.nextCursorPointer).not.toBeNull(); // Should have next page
        expect(page1.prevCursorPointer).toBeNull(); // No previous page on first page

        // Store emails from first page
        const page1Emails = page1.data.map(u => u.getEmail()).sort();

        // Second page - using nextCursorPointer
        const nextCursor = JSON.stringify(page1.nextCursorPointer);
        const page2 = await repository.listByStatus(
          'PENDING',
          2,
          'next',
          nextCursor,
          undefined
        );

        // Verify second page
        expect(page2.data.length).toBeGreaterThan(0);
        expect(page2.data.every(u => u.getUserStatus() === 'PENDING')).toBe(true);
        expect(page2.prevCursorPointer).not.toBeNull(); // Should have previous page

        // Verify no duplicate data between pages
        const page2Emails = page2.data.map(u => u.getEmail()).sort();
        const overlap = page1Emails.filter(email => page2Emails.includes(email));
        expect(overlap.length).toBe(0); // No duplicates
      });

      it('should handle last page correctly (nextCursorPointer should be null)', async () => {
        // Create a new status with only 3 users
        const testUsers = [
          User.create({ email: 'last-page-1@example.com', firstName: 'Last', lastName: 'One' }),
          User.create({ email: 'last-page-2@example.com', firstName: 'Last', lastName: 'Two' }),
          User.create({ email: 'last-page-3@example.com', firstName: 'Last', lastName: 'Three' }),
        ];

        for (const user of testUsers) {
          user.verifyEmail(); // Must verify before activating
          user.activate(); // Set to ACTIVE status
          await repository.save(user);
        }

        // Get all with limit larger than total
        const result = await repository.listByStatus('ACTIVE', 10, 'next');

        expect(result.data.length).toBeLessThanOrEqual(10);
        expect(result.data.every(u => u.getUserStatus() === 'ACTIVE')).toBe(true);
        expect(result.nextCursorPointer).toBeNull(); // No more pages
      });

      it('should handle empty results correctly', async () => {
        // Query for status that has no users
        const result = await repository.listByStatus('DELETED', 10, 'next');

        expect(result.data.length).toBe(0);
        expect(result.nextCursorPointer).toBeNull();
        expect(result.prevCursorPointer).toBeNull();
      });

      it('should maintain data integrity across multiple pages', async () => {
        const allPages: string[] = [];
        let currentNextCursor: string | undefined = undefined;
        let pageCount = 0;
        const maxPages = 10; // Safety limit

        // Traverse all pages
        while (pageCount < maxPages) {
          const page = await repository.listByStatus(
            'PENDING',
            2,
            'next',
            currentNextCursor,
            undefined
          );

          // Collect emails
          const emails = page.data.map(u => u.getEmail());
          allPages.push(...emails);

          // Check for duplicates within collected data
          const uniqueEmails = new Set(allPages);
          expect(uniqueEmails.size).toBe(allPages.length); // No duplicates

          // Move to next page
          if (page.nextCursorPointer === null) {
            break; // Reached last page
          }

          currentNextCursor = JSON.stringify(page.nextCursorPointer);
          pageCount++;
        }

        // Verify we got multiple pages
        expect(pageCount).toBeGreaterThan(0);
        expect(allPages.length).toBeGreaterThanOrEqual(5); // At least our test data
      });
    });
  });

  describe('save() — update user profile via domain method', () => {
    it('should persist profile changes made via entity updateProfile()', async () => {
      // Create and save initial user
      const user = User.create({
        email: 'update-test@example.com',
        firstName: 'Original',
        lastName: 'Name',
      });
      const saved = await repository.save(user);

      // Mutate via domain method (no direct repository update call)
      const userId = saved.getUserId();
      expect(userId).toBeDefined();
      saved.updateProfile('Updated', 'NewName');
      const updated = await repository.save(saved);

      // Verify updates
      expect(updated.getFirstName()).toBe('Updated');
      expect(updated.getLastName()).toBe('NewName');
      expect(updated.getEmail()).toBe('update-test@example.com'); // Unchanged

      // Retrieve from DB to verify persistence
      const retrieved = await repository.findById(userId as string);
      expect(retrieved?.getFirstName()).toBe('Updated');
      expect(retrieved?.getLastName()).toBe('NewName');
    });
  });

  describe('save() — status transitions via domain methods', () => {
    it('should persist ACTIVE status after calling entity activate()', async () => {
      // Create user
      const user = User.create({
        email: 'status-test@example.com',
        firstName: 'Status',
        lastName: 'Test',
      });
      let saved = await repository.save(user);

      // Verify email first and save
      saved.verifyEmail();
      saved = await repository.save(saved);

      const userId = saved.getUserId();
      expect(userId).toBeDefined();
      const reloaded = await repository.findById(userId as string);
      expect(reloaded?.isEmailVerified()).toBe(true);

      // Activate via domain method — enforces PENDING + emailVerified guards
      reloaded!.activate();
      const activated = await repository.save(reloaded!);

      expect(activated.getUserStatus()).toBe('ACTIVE');
      expect(activated.isActive()).toBe(true);
    });
  });

  describe('domain entity persistence', () => {
    it('should preserve all entity properties through save/load cycle', async () => {
      const user = User.create({
        email: 'full-test@example.com',
        firstName: 'Full',
        lastName: 'Test',
        userRole: 'ADMIN',
        data: { country: 'US' },
      });

      // Modify state
      user.verifyEmail();

      // Save
      const saved = await repository.save(user);

      // Retrieve
      const userId = saved.getUserId();
      expect(userId).toBeDefined();
      const retrieved = await repository.findById(userId as string);

      // Verify all properties preserved
      expect(retrieved?.getEmail()).toBe('full-test@example.com');
      expect(retrieved?.getFirstName()).toBe('Full');
      expect(retrieved?.getLastName()).toBe('Test');
      expect(retrieved?.getUserRole()).toBe('ADMIN');
      expect(retrieved?.isEmailVerified()).toBe(true);
      expect(retrieved?.getUserStatus()).toBe('PENDING');
    });
  });
});
