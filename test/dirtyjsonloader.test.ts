import { DirtyJSONLoader } from '../src';

describe('simple json parse test', () => {
  it('basic', () => {
    const loader = new DirtyJSONLoader('{}');
    console.log(loader.scan());
    expect(loader).toBeDefined();
  });

  it('tests correct JSON parsing', () => {
    const loader = new DirtyJSONLoader('{"a": "b"}');
    const result = loader.scan();

    const resultData = result.data;
    const expectedData = { a: 'b' };

    expect(resultData).toEqual(expectedData);
  });

  it('tests incorrect JSON parsing', () => {
    const loader = new DirtyJSONLoader(`{"a": "b'}`);
    const result = loader.scan();

    const resultData = result.data;
    const expectedData = { a: 'b' };

    expect(resultData).toEqual(expectedData);
  });
});
