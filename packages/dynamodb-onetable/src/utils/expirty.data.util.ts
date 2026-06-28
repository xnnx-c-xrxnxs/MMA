export const getTtlExpiryDate = (numOfDays: number): number => {
    const currentDate = new Date();
    const expire_at = Math.floor((currentDate.getTime() + numOfDays * 24 * 60 * 60 * 1000) / 1000);
    return expire_at;
}
