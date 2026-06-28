import { ProductCategory } from './product-category.entity';
import { CategoryStatusEnum } from '../../constants';
import {
  InvalidCategoryNameError,
  CannotActivateNonInactiveCategoryError,
  CannotDeactivateNonActiveCategoryError,
  CannotDiscontinueCategoryError,
  CategoryAlreadyDeletedError,
  CannotUpdateDeletedCategoryError,
} from '../../exceptions';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeActiveCategory(): ProductCategory {
  return ProductCategory.reconstitute({
    categoryId: 'cat-1',
    name: 'Electronics',
    description: 'Electronic devices',
    status: CategoryStatusEnum.ACTIVE,
    dateCreated: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  });
}

function makeInactiveCategory(): ProductCategory {
  return ProductCategory.reconstitute({
    categoryId: 'cat-2',
    name: 'Clothing',
    description: 'Apparel items',
    status: CategoryStatusEnum.INACTIVE,
    dateCreated: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  });
}

function makeDiscontinuedCategory(): ProductCategory {
  return ProductCategory.reconstitute({
    categoryId: 'cat-3',
    name: 'Legacy',
    description: undefined,
    status: CategoryStatusEnum.DISCONTINUED,
    dateCreated: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  });
}

function makeDeletedCategory(): ProductCategory {
  return ProductCategory.reconstitute({
    categoryId: 'cat-4',
    name: 'Removed',
    description: undefined,
    status: CategoryStatusEnum.DELETED,
    dateCreated: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ProductCategory', () => {
  // ── create() ─────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a category with trimmed name, trimmed description, ACTIVE status, and null categoryId', () => {
      const category = ProductCategory.create({
        name: '  Books  ',
        description: '  All kinds of books  ',
      });

      expect(category.getCategoryId()).toBeNull();
      expect(category.getName()).toBe('Books');
      expect(category.getDescription()).toBe('All kinds of books');
      expect(category.getStatus()).toBe(CategoryStatusEnum.ACTIVE);
      expect(category.getDateCreated()).toBeDefined();
      expect(category.getUpdatedAt()).toBe(category.getDateCreated());
    });

    it('should allow undefined description', () => {
      const category = ProductCategory.create({ name: 'Toys' });

      expect(category.getDescription()).toBeUndefined();
    });

    it('should throw InvalidCategoryNameError when name is empty', () => {
      expect(() => ProductCategory.create({ name: '' })).toThrow(InvalidCategoryNameError);
    });

    it('should throw InvalidCategoryNameError when name is only whitespace', () => {
      expect(() => ProductCategory.create({ name: '   ' })).toThrow(InvalidCategoryNameError);
    });
  });

  // ── reconstitute() ──────────────────────────────────────────────────────

  describe('reconstitute()', () => {
    it('should restore all fields exactly as provided', () => {
      const props = {
        categoryId: 'cat-99',
        name: 'Furniture',
        description: 'Home furniture',
        status: CategoryStatusEnum.INACTIVE,
        dateCreated: '2024-06-15T12:00:00.000Z',
        updatedAt: '2025-02-20T08:30:00.000Z',
      };

      const category = ProductCategory.reconstitute(props);

      expect(category.getCategoryId()).toBe('cat-99');
      expect(category.getName()).toBe('Furniture');
      expect(category.getDescription()).toBe('Home furniture');
      expect(category.getStatus()).toBe(CategoryStatusEnum.INACTIVE);
      expect(category.getDateCreated()).toBe('2024-06-15T12:00:00.000Z');
      expect(category.getUpdatedAt()).toBe('2025-02-20T08:30:00.000Z');
    });

    it('should restore a DELETED category without throwing', () => {
      const category = makeDeletedCategory();
      expect(category.getStatus()).toBe(CategoryStatusEnum.DELETED);
    });
  });

  // ── activate() ──────────────────────────────────────────────────────────

  describe('activate()', () => {
    it('should activate an INACTIVE category', () => {
      const category = makeInactiveCategory();
      category.activate();

      expect(category.getStatus()).toBe(CategoryStatusEnum.ACTIVE);
      expect(category.getUpdatedAt()).not.toBe('2025-01-01T00:00:00.000Z');
    });

    it('should throw CannotActivateNonInactiveCategoryError when ACTIVE', () => {
      const category = makeActiveCategory();
      expect(() => category.activate()).toThrow(CannotActivateNonInactiveCategoryError);
    });

    it('should throw CannotActivateNonInactiveCategoryError when DELETED', () => {
      const category = makeDeletedCategory();
      expect(() => category.activate()).toThrow(CannotActivateNonInactiveCategoryError);
    });

    it('should throw CannotActivateNonInactiveCategoryError when DISCONTINUED', () => {
      const category = makeDiscontinuedCategory();
      expect(() => category.activate()).toThrow(CannotActivateNonInactiveCategoryError);
    });
  });

  // ── deactivate() ────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('should deactivate an ACTIVE category', () => {
      const category = makeActiveCategory();
      category.deactivate();

      expect(category.getStatus()).toBe(CategoryStatusEnum.INACTIVE);
      expect(category.getUpdatedAt()).not.toBe('2025-01-01T00:00:00.000Z');
    });

    it('should throw CannotDeactivateNonActiveCategoryError when INACTIVE', () => {
      const category = makeInactiveCategory();
      expect(() => category.deactivate()).toThrow(CannotDeactivateNonActiveCategoryError);
    });

    it('should throw CannotDeactivateNonActiveCategoryError when DELETED', () => {
      const category = makeDeletedCategory();
      expect(() => category.deactivate()).toThrow(CannotDeactivateNonActiveCategoryError);
    });
  });

  // ── discontinue() ──────────────────────────────────────────────────────

  describe('discontinue()', () => {
    it('should discontinue an ACTIVE category', () => {
      const category = makeActiveCategory();
      category.discontinue();

      expect(category.getStatus()).toBe(CategoryStatusEnum.DISCONTINUED);
      expect(category.getUpdatedAt()).not.toBe('2025-01-01T00:00:00.000Z');
    });

    it('should discontinue an INACTIVE category', () => {
      const category = makeInactiveCategory();
      category.discontinue();

      expect(category.getStatus()).toBe(CategoryStatusEnum.DISCONTINUED);
    });

    it('should throw CannotDiscontinueCategoryError when DELETED', () => {
      const category = makeDeletedCategory();
      expect(() => category.discontinue()).toThrow(CannotDiscontinueCategoryError);
    });

    it('should throw CannotDiscontinueCategoryError when already DISCONTINUED', () => {
      const category = makeDiscontinuedCategory();
      expect(() => category.discontinue()).toThrow(CannotDiscontinueCategoryError);
    });
  });

  // ── markAsDeleted() ─────────────────────────────────────────────────────

  describe('markAsDeleted()', () => {
    it('should mark an ACTIVE category as DELETED', () => {
      const category = makeActiveCategory();
      category.markAsDeleted();

      expect(category.getStatus()).toBe(CategoryStatusEnum.DELETED);
      expect(category.getUpdatedAt()).not.toBe('2025-01-01T00:00:00.000Z');
    });

    it('should mark an INACTIVE category as DELETED', () => {
      const category = makeInactiveCategory();
      category.markAsDeleted();

      expect(category.getStatus()).toBe(CategoryStatusEnum.DELETED);
    });

    it('should mark a DISCONTINUED category as DELETED', () => {
      const category = makeDiscontinuedCategory();
      category.markAsDeleted();

      expect(category.getStatus()).toBe(CategoryStatusEnum.DELETED);
    });

    it('should throw CategoryAlreadyDeletedError when already DELETED', () => {
      const category = makeDeletedCategory();
      expect(() => category.markAsDeleted()).toThrow(CategoryAlreadyDeletedError);
    });
  });

  // ── updateDetails() ─────────────────────────────────────────────────────

  describe('updateDetails()', () => {
    it('should update name and description with trimming', () => {
      const category = makeActiveCategory();
      category.updateDetails('  Updated Name  ', '  Updated Description  ');

      expect(category.getName()).toBe('Updated Name');
      expect(category.getDescription()).toBe('Updated Description');
      expect(category.getUpdatedAt()).not.toBe('2025-01-01T00:00:00.000Z');
    });

    it('should allow clearing description to undefined', () => {
      const category = makeActiveCategory();
      category.updateDetails('Still Valid');

      expect(category.getDescription()).toBeUndefined();
    });

    it('should throw CannotUpdateDeletedCategoryError when DELETED', () => {
      const category = makeDeletedCategory();
      expect(() => category.updateDetails('New Name', 'Desc')).toThrow(CannotUpdateDeletedCategoryError);
    });

    it('should throw InvalidCategoryNameError when name is empty', () => {
      const category = makeActiveCategory();
      expect(() => category.updateDetails('', 'Desc')).toThrow(InvalidCategoryNameError);
    });

    it('should throw InvalidCategoryNameError when name is only whitespace', () => {
      const category = makeActiveCategory();
      expect(() => category.updateDetails('   ')).toThrow(InvalidCategoryNameError);
    });
  });

  // ── Status query methods ───────────────────────────────────────────────

  describe('status query methods', () => {
    it('isActive() returns true only for ACTIVE', () => {
      expect(makeActiveCategory().isActive()).toBe(true);
      expect(makeInactiveCategory().isActive()).toBe(false);
    });

    it('isInactive() returns true only for INACTIVE', () => {
      expect(makeInactiveCategory().isInactive()).toBe(true);
      expect(makeActiveCategory().isInactive()).toBe(false);
    });

    it('isDiscontinued() returns true only for DISCONTINUED', () => {
      expect(makeDiscontinuedCategory().isDiscontinued()).toBe(true);
      expect(makeActiveCategory().isDiscontinued()).toBe(false);
    });

    it('isDeleted() returns true only for DELETED', () => {
      expect(makeDeletedCategory().isDeleted()).toBe(true);
      expect(makeActiveCategory().isDeleted()).toBe(false);
    });
  });

});
