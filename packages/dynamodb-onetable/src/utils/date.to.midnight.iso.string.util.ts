export const setTimeToMidnightISOString = (date: string) => {
    const dateToObj = new Date(date);
    dateToObj.setUTCHours(0, 0, 0, 0);
    return dateToObj.toISOString();
}

