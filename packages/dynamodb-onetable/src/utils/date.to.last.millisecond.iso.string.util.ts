export const setTimeToLastMillisecondISOString = (date: string) => {
    const dateToObj = new Date(date);
    dateToObj.setUTCHours(23, 59, 59, 999);
    return dateToObj.toISOString();
}