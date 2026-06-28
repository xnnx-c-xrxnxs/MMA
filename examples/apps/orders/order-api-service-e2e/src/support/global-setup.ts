import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
declare global {
  var __TEARDOWN_MESSAGE__: string;
}

module.exports = async function () {
  console.log('\nSetting up Order E2E tests...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.ORDER_SERVICE_PORT
    ? Number(process.env.ORDER_SERVICE_PORT)
    : 3002;
  await waitForPortOpen(port, { host });

  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
