import { BadRequestException } from '@nestjs/common';

export function createDynamoDbOptionWithPKSKIndex(
    limit: number,
    indexName: string,
    direction: string,
    cursorPointer: string
) {


    if (!limit || limit == 0) {
        limit = 0;
    }

    //somehow limit is coming as string
    const limitNumber = parseInt(limit.toString());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbOptions: { [key: string]: any } = {};


    dbOptions['limit'] = limitNumber + 1;
    dbOptions['follow'] = true;

    // Only process cursor if it's a non-empty string
    if (cursorPointer && cursorPointer.trim() !== '') {
        const sanitizedCursorPointer = decodeURIComponent(cursorPointer);
        const parsedCursor = JSON.parse(sanitizedCursorPointer);
        
        // DynamoDB OneTable expects 'next' or 'prev' or 'start' for cursor
        if (direction === 'prev') {
            dbOptions['prev'] = parsedCursor;
            dbOptions['reverse'] = true; // Reverse scan for backward pagination
        } else {
            // Forward pagination (default)
            dbOptions['next'] = parsedCursor;
        }
    }

    if (indexName != null) {
        dbOptions['index'] = indexName;
    }

    return dbOptions;
}
