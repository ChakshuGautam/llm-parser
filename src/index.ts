import { DirtyJSONLoader, AttributedDict } from './json/parser';

export const sum = (a: number, b: number) => {
  if ('development' === process.env.NODE_ENV) {
    console.log('boop');
  }
  return a + b;
};

export { DirtyJSONLoader, AttributedDict };
