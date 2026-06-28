export const getMondayOfTheDate = (date: Date) => {
    const targetDate = new Date(date);
    const day = targetDate.getDay();
    const diff = targetDate.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    return new Date(targetDate.setDate(diff)).toISOString().slice(0, 10);
};