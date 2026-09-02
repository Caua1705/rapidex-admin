import { expect, it } from 'vitest';
it('sonda', () => {
  console.log(
    'FUSO=',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    'OFFSET=',
    new Date().getTimezoneOffset(),
    'ENVTZ=',
    process.env.TZ,
  );
  expect(1).toBe(1);
});
