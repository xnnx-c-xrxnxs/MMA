import { IPaginatedResponse, CursorPointer } from '@old-st/common';

/**
 * Handles cursor-based pagination for DynamoDB query results.
 * Returns a common interface suitable for repository implementations.
 * 
 * @template T - Type of records being paginated
 * @param records - Array of records from DynamoDB query
 * @param limit - Maximum number of records per page
 * @param direction - Pagination direction ('next' or 'prev')
 * @param indexKey - GSI/LSI partition key name
 * @param sortKey - GSI/LSI sort key name
 * @param primaryKey - Table partition key name
 * @param primarySortKey - Table sort key name
 * @param nextCursorPointer - Serialized cursor for next page
 * @param prevCursorPointer - Serialized cursor for previous page
 * @returns Paginated response with data and cursor pointers
 */
export function pageRecordHandler<T = Record<string, unknown>>(
    records: T[],
    limit: number,
    direction: string,
    indexKey: string,
    sortKey: string,
    primaryKey: string,
    primarySortKey: string,
    nextCursorPointer: string,
    prevCursorPointer: string,
): IPaginatedResponse<T> {
    // Parse cursors only if they're non-empty strings
    const hasNextCursor = nextCursorPointer && nextCursorPointer.trim() !== '';
    const hasPrevCursor = prevCursorPointer && prevCursorPointer.trim() !== '';
    


    // Handle empty results
    if (records.length === 0) {
        return {
            data: records,
            nextCursorPointer: null,
            prevCursorPointer: null,
        };
    }

    // We queried with limit+1 to check if there are more records
    // If we got exactly limit+1, there's a next page
    const hasMore = records.length > limit;
    
    let resultNextCursor: CursorPointer = null;
    let resultPrevCursor: CursorPointer = null;

    // First page (no cursors)
    if (!hasNextCursor && !hasPrevCursor) {
        if (hasMore) {
            // Remove the extra record and create next cursor
            records.pop();
            resultNextCursor = getLastRecordCursor(records, indexKey, sortKey, primaryKey, primarySortKey);
        }
        resultPrevCursor = null; // First page has no previous
    }
    // Navigating forward (has nextCursor)
    else if (hasNextCursor && direction !== 'prev') {
        if (hasMore) {
            records.pop(); // Remove the +1 item
            resultNextCursor = getLastRecordCursor(records, indexKey, sortKey, primaryKey, primarySortKey);
        }
        // Set previous cursor to first record of current page
        resultPrevCursor = getFirstRecordCursor(records, indexKey, sortKey, primaryKey, primarySortKey);
    }
    // Navigating backward (has prevCursor)
    else if (hasPrevCursor && direction === 'prev') {
        if (hasMore) {
            records.shift(); // Remove the +1 item from beginning
            resultPrevCursor = getFirstRecordCursor(records, indexKey, sortKey, primaryKey, primarySortKey);
        }
        // Set next cursor to last record of current page
        resultNextCursor = getLastRecordCursor(records, indexKey, sortKey, primaryKey, primarySortKey);
    }

    return {
        data: records,
        nextCursorPointer: resultNextCursor,
        prevCursorPointer: resultPrevCursor,
    };
}

function getFirstRecordCursor<T = Record<string, unknown>>(
    records: T[],
    indexKey: string,
    sortKey: string,
    primaryKey: string,
    primarySortKey: string
): CursorPointer {
    if (records.length === 0) {
        return null;
    }

    const firstRecord = records[0] as Record<string, unknown>;

    return {
        [indexKey]: firstRecord[indexKey],
        [sortKey]: firstRecord[sortKey],
        [primaryKey]: firstRecord[primaryKey],
        [primarySortKey]: firstRecord[primarySortKey],
    };
}

function getLastRecordCursor<T = Record<string, unknown>>(
    records: T[],
    indexKey: string,
    sortKey: string,
    primaryKey: string,
    primarySortKey: string
): CursorPointer {
    if (records.length === 0) {
        return null;
    }

    const lastRecord = records[records.length - 1] as Record<string, unknown>;

    return {
        [indexKey]: lastRecord[indexKey],
        [sortKey]: lastRecord[sortKey],
        [primaryKey]: lastRecord[primaryKey],
        [primarySortKey]: lastRecord[primarySortKey],
    };
}
