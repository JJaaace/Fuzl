import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureGuestEntry, newEditPermission, permissionKey, readPermission } from './api';
test('guest entry removes fragment before network work and reload uses only this tab invite credential', async () => {
    const invite = newEditPermission().editToken;
    const data = new Map<string, string>();
    const paths: string[] = [];
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    assert.equal(captureGuestEntry(`http://127.0.0.1:5173/guest#invite=${invite}`, p => paths.push(p), storage), invite);
    assert.deepEqual(paths, ['/guest']);
    assert.equal(captureGuestEntry('http://127.0.0.1:5173/guest', () => { }, storage), invite);
    assert.equal(captureGuestEntry(`http://127.0.0.1:5173/guest?invite=${invite}`, () => { }, storage), null);
    const key = await permissionKey(invite);
    assert.ok(!key.includes(invite));
    data.set(key, '{"editToken":"do-not-expose-this-secret');
    assert.throws(() => readPermission(storage, key), error => error instanceof Error && !error.message.includes('do-not-expose-this-secret'));
});
