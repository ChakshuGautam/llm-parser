import { DirtyJSONLoader } from '../src';

describe('simple json parse test', () => {
  it('basic', () => {
    const loader = new DirtyJSONLoader('{}');
    console.log(loader.scan());
    expect(loader).toBeDefined();
  });

  test('Basic JSON parsing', () => {
    const loader = new DirtyJSONLoader('{"a": "b"}');
    const result = loader.scan();

    const resultData = result.data;
    const expectedData = { a: 'b' };

    expect(resultData).toEqual(expectedData);
  });
});
