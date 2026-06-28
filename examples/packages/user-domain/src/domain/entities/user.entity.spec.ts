import { User } from './user.entity';
import { USER_ROLES, USER_STATUSES } from '../constants';
import {
  InvalidEmailFormatError,
  InvalidNameError,
  EmailAlreadyVerifiedError,
  CannotActivateNonPendingUserError,
  CannotActivateUnverifiedEmailError,
  CannotDeactivateDeletedUserError,
  UserAlreadyHasRoleError,
} from '../exceptions';

/**
 * Unit Tests for User Entity (Domain Layer)
 * Testing business logic and state transitions
 */
describe('User Entity', () => {
  describe('create()', () => {
    it('should create a new user with valid data', () => {
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userRole: 'USER',
      });

      expect(user.getEmail()).toBe('test@example.com');
      expect(user.getFirstName()).toBe('John');
      expect(user.getLastName()).toBe('Doe');
      expect(user.getUserRole()).toBe('USER');
      expect(user.getUserStatus()).toBe('PENDING');
      expect(user.isEmailVerified()).toBe(false);
      expect(user.getUserId()).toBeNull(); // Not persisted yet
    });

    it('should normalize email to lowercase', () => {
      const user = User.create({
        email: 'TEST@EXAMPLE.COM',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(user.getEmail()).toBe('test@example.com');
    });

    it('should trim whitespace from names', () => {
      const user = User.create({
        email: 'test@example.com',
        firstName: '  John  ',
        lastName: '  Doe  ',
      });

      expect(user.getFirstName()).toBe('John');
      expect(user.getLastName()).toBe('Doe');
    });

    it('should default to USER role if not specified', () => {
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(user.getUserRole()).toBe('USER');
    });

    it('should throw error for invalid email format', () => {
      expect(() => {
        User.create({
          email: 'invalid-email',
          firstName: 'John',
          lastName: 'Doe',
        });
      }).toThrow(InvalidEmailFormatError);
    });

    it('should throw error for empty first name', () => {
      expect(() => {
        User.create({
          email: 'test@example.com',
          firstName: '   ',
          lastName: 'Doe',
        });
      }).toThrow(InvalidNameError);
    });

    it('should throw error for empty last name', () => {
      expect(() => {
        User.create({
          email: 'test@example.com',
          firstName: 'John',
          lastName: '',
        });
      }).toThrow(InvalidNameError);
    });
  });

  describe('verifyEmail()', () => {
    it('should verify email successfully', () => {
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(user.isEmailVerified()).toBe(false);
      
      user.verifyEmail();
      
      expect(user.isEmailVerified()).toBe(true);
    });

    it('should throw error if email already verified', () => {
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      user.verifyEmail();

      expect(() => {
        user.verifyEmail();
      }).toThrow(EmailAlreadyVerifiedError);
    });
  });

  describe('activate()', () => {
    it('should activate pending user', () => {
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      user.verifyEmail(); // Must verify email first
      user.activate();

      expect(user.getUserStatus()).toBe('ACTIVE');
      expect(user.isActive()).toBe(true);
    });

    it('should throw error if email not verified', () => {
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(() => {
        user.activate();
      }).toThrow(CannotActivateUnverifiedEmailError);
    });

    it('should allow activation if email is verified', () => {
      const user = User.create({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      user.verifyEmail();
      user.activate();

      expect(user.getUserStatus()).toBe('ACTIVE');
    });

    it('should throw error if user is deleted', () => {
      const user = User.reconstitute({
        userId: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        userRole: 'USER',
        userStatus: 'DELETED',
        data: {},
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => {
        user.activate();
      }).toThrow(CannotActivateNonPendingUserError);
    });
  });

  describe('deactivate()', () => {
    it('should deactivate active user', () => {
      const user = User.reconstitute({
        userId: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        userRole: 'USER',
        userStatus: 'ACTIVE',
        data: {},
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      user.deactivate();

      expect(user.getUserStatus()).toBe('INACTIVE');
      expect(user.isActive()).toBe(false);
    });

    it('should throw error if user is deleted', () => {
      const user = User.reconstitute({
        userId: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        userRole: 'USER',
        userStatus: 'DELETED',
        data: {},
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => {
        user.deactivate();
      }).toThrow(CannotDeactivateDeletedUserError);
    });
  });

  describe('changeRole()', () => {
    it('should change user role', () => {
      const user = User.reconstitute({
        userId: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        userRole: 'USER',
        userStatus: 'ACTIVE',
        data: {},
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      user.changeRole('ADMIN');

      expect(user.getUserRole()).toBe('ADMIN');
    });

    it('should throw error if changing to same role', () => {
      const user = User.reconstitute({
        userId: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        userRole: 'ADMIN',
        userStatus: 'ACTIVE',
        data: {},
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => {
        user.changeRole('ADMIN');
      }).toThrow(UserAlreadyHasRoleError);
    });
  });

  describe('updateProfile()', () => {
    it('should update first and last name', () => {
      const user = User.reconstitute({
        userId: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        userRole: 'USER',
        userStatus: 'ACTIVE',
        data: {},
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      user.updateProfile('Jane', 'Smith');

      expect(user.getFirstName()).toBe('Jane');
      expect(user.getLastName()).toBe('Smith');
    });

    it('should update only first name', () => {
      const user = User.reconstitute({
        userId: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        userRole: 'USER',
        userStatus: 'ACTIVE',
        data: {},
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      user.updateProfile('Jane', 'Doe');

      expect(user.getFirstName()).toBe('Jane');
      expect(user.getLastName()).toBe('Doe'); // Unchanged
    });

    it('should throw error for empty name', () => {
      const user = User.reconstitute({
        userId: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        userRole: 'USER',
        userStatus: 'ACTIVE',
        data: {},
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => {
        user.updateProfile('   ', 'Doe');
      }).toThrow(InvalidNameError);
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute user from database data', () => {
      const now = new Date().toISOString();
      
      const user = User.reconstitute({
        userId: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        userRole: 'ADMIN',
        userStatus: 'ACTIVE',
        data: { country: 'US' },
        dateCreated: now,
        updatedAt: now,
      });

      expect(user.getUserId()).toBe('123');
      expect(user.getEmail()).toBe('test@example.com');
      expect(user.getFirstName()).toBe('John');
      expect(user.getLastName()).toBe('Doe');
      expect(user.isEmailVerified()).toBe(true);
      expect(user.getUserRole()).toBe('ADMIN');
      expect(user.getUserStatus()).toBe('ACTIVE');
      expect(user.isActive()).toBe(true);
    });
  });
});
