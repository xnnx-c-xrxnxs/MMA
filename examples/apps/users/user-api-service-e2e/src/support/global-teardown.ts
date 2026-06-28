/* eslint-disable */
export {};

declare global {
  var __TEARDOWN_MESSAGE__: string;
}

module.exports = async function () {
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
